import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";

const MAX_BODY = 8 * 1024 * 1024;
const png = "iVBORw0KGgo";
export class ServiceError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function validateRequest(body) {
  if (
    !body ||
    typeof body !== "object" ||
    typeof body.prompt !== "string" ||
    !body.prompt.trim() ||
    body.prompt.length > 4000
  )
    throw new ServiceError(
      400,
      "A description of 1–4000 characters is required.",
    );
  if (
    body.reference !== undefined &&
    (typeof body.reference !== "string" ||
      body.reference.length > MAX_BODY - 5000 ||
      !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(
        body.reference,
      ))
  )
    throw new ServiceError(
      400,
      "Use an embedded PNG, JPEG or WebP reference under 6 MB.",
    );
  return {
    prompt: body.prompt.trim(),
    ...(body.reference ? { reference: body.reference } : {}),
  };
}
export async function openAIImage(
  body,
  { apiKey, model = "gpt-image-1.5", request = fetch, signal } = {},
) {
  const options = {
    model,
    prompt: body.prompt,
    n: 1,
    size: "1024x1024",
    quality: "low",
    background: "transparent",
    output_format: "png",
  };
  const endpoint = body.reference ? "edits" : "generations";
  if (body.reference) options.images = [{ image_url: body.reference }];
  const response = await request(
    `https://api.openai.com/v1/images/${endpoint}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(options),
      signal,
    },
  );
  if (!response.ok) {
    // Never relay provider response bodies: they can contain prompts or account details.
    const status =
      response.status === 429 ? 429 : response.status === 400 ? 422 : 503;
    throw new ServiceError(
      status,
      status === 422
        ? "Adjust the description or reference and try again."
        : "The image provider is unavailable or at its limit.",
    );
  }
  const result = await response.json();
  const image = result.data?.[0]?.b64_json;
  if (
    typeof image !== "string" ||
    image.length > 12 * 1024 * 1024 ||
    !image.startsWith(png) ||
    !/^[A-Za-z0-9+/=]+$/.test(image)
  )
    throw new ServiceError(502, "The provider returned an unreadable image.");
  // Retain only documented numerical usage counters, never arbitrary provider text.
  const usage = {};
  for (const key of ["total_tokens", "input_tokens", "output_tokens"]) {
    if (Number.isSafeInteger(result.usage?.[key]) && result.usage[key] >= 0)
      usage[key] = result.usage[key];
  }
  for (const key of ["input_tokens_details", "output_tokens_details"]) {
    const details = {};
    for (const counter of ["text_tokens", "image_tokens", "cached_tokens"]) {
      if (Number.isSafeInteger(result.usage?.[key]?.[counter]) && result.usage[key][counter] >= 0)
        details[counter] = result.usage[key][counter];
    }
    if (Object.keys(details).length) usage[key] = details;
  }
  return {
    image: `data:image/png;base64,${image}`, model,
    ...(Object.keys(usage).length ? { usage } : {}),
  };
}
export function createGenerationServer({
  apiKey = process.env.OPENAI_API_KEY,
  token = process.env.GENERATION_ACCESS_TOKEN,
  model = process.env.GENERATION_MODEL || "gpt-image-1.5",
  origin = process.env.GENERATION_WEB_ORIGIN || "http://localhost:8081",
  limit = Number(process.env.GENERATION_DAILY_LIMIT || 24),
  generate = openAIImage,
} = {}) {
  if (!token || token.length < 24)
    throw new Error(
      "Set GENERATION_ACCESS_TOKEN to a random value of at least 24 characters.",
    );
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000)
    throw new Error("GENERATION_DAILY_LIMIT must be 1–1000.");
  let active = 0;
  let used = 0;
  let day = new Date().toISOString().slice(0, 10);
  const expected = Buffer.from(`Bearer ${token}`);
  return createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Type", "application/json");
    if (req.headers.origin && req.headers.origin !== origin) {
      res.writeHead(403);
      res.end(JSON.stringify({ error: "Origin not allowed." }));
      return;
    }
    if (req.headers.origin)
      res.setHeader("Access-Control-Allow-Origin", origin);
    if (req.method === "OPTIONS") {
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type",
      );
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.writeHead(204);
      res.end();
      return;
    }
    const supplied = Buffer.from(req.headers.authorization || "");
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: "Access code required." }));
      return;
    }
    if (req.url !== "/v1/stickers" || req.method !== "POST") {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not found." }));
      return;
    }
    let acquired = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 150000);
    res.on("close", () => {
      if (!res.writableEnded) controller.abort();
    });
    try {
      if (!apiKey) throw new ServiceError(503, "Generation is not configured.");
      if (!(req.headers["content-type"] || "").startsWith("application/json"))
        throw new ServiceError(415, "Send JSON.");
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY)
          throw new ServiceError(413, "Reference is too large.");
        chunks.push(chunk);
      }
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString());
      } catch {
        throw new ServiceError(400, "Invalid JSON.");
      }
      const input = validateRequest(body);
      const today = new Date().toISOString().slice(0, 10);
      if (today !== day) {
        day = today;
        used = 0;
      }
      if (active >= 2 || used >= limit)
        throw new ServiceError(429, "Generation limit reached. Try later.");
      active++;
      used++;
      acquired = true;
      const result = await generate(input, {
        apiKey,
        model,
        signal: controller.signal,
      });
      res.writeHead(200);
      res.end(JSON.stringify(result));
    } catch (error) {
      if (!res.destroyed) {
        const status = controller.signal.aborted
          ? 504
          : error instanceof ServiceError
            ? error.status
            : 503;
        res.writeHead(status);
        res.end(
          JSON.stringify({
            error:
              error instanceof ServiceError
                ? error.message
                : "Generation did not finish. Your draft is safe.",
          }),
        );
      }
    } finally {
      clearTimeout(timeout);
      if (acquired) active--;
    }
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const server = createGenerationServer();
  server.requestTimeout = 170000;
  server.headersTimeout = 15000;
  server.listen(
    Number(process.env.GENERATION_PORT || 8787),
    process.env.GENERATION_HOST || "127.0.0.1",
    () =>
      console.log(
        "Bias Studio generation service ready. Request content is not logged.",
      ),
  );
}

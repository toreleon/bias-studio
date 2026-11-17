import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGenerationServer,
  openAIImage,
  validateRequest,
} from "../server/generation.mjs";
const token = "test-studio-token-at-least-24-characters";
const image = "data:image/png;base64,iVBORw0KGgo=";
async function fixture(t, options = {}) {
  const server = createGenerationServer({
    token,
    apiKey: "test-only",
    ...options,
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return (body, extra = {}) =>
    fetch(`http://127.0.0.1:${server.address().port}/v1/stickers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...extra,
      },
      body: JSON.stringify(body),
    });
}
test("service rejects missing auth, unwanted origins, remote references and invalid bodies before provider calls", async (t) => {
  let calls = 0;
  const send = await fixture(t, {
    generate: async () => {
      calls++;
      return { image, model: "test" };
    },
  });
  assert.equal(
    (await send({ prompt: "cat" }, { Authorization: "" })).status,
    401,
  );
  assert.equal(
    (await send({ prompt: "cat" }, { Origin: "https://untrusted.test" }))
      .status,
    403,
  );
  assert.equal(
    (await send({ prompt: "cat", reference: "https://untrusted.test/a.png" }))
      .status,
    400,
  );
  assert.equal((await send({ prompt: "" })).status, 400);
  assert.equal(calls, 0);
});
test("configured generation returns a real provider contract and budget fails closed", async (t) => {
  const send = await fixture(t, {
    limit: 1,
    generate: async (input) => {
      assert.equal(input.prompt, "cat");
      return { image, model: "test" };
    },
  });
  assert.deepEqual(await (await send({ prompt: "cat" })).json(), {
    image,
    model: "test",
  });
  assert.equal((await send({ prompt: "cat" })).status, 429);
});
test("unconfigured service exposes no fake success, provider secrets or stack traces", async (t) => {
  const send = await fixture(t, {
    apiKey: "",
    generate: () => {
      throw new Error("never called");
    },
  });
  assert.equal((await send({ prompt: "cat" })).status, 503);
  const broken = await fixture(t, {
    generate: async () => {
      throw new Error("secret key and private prompt");
    },
  });
  const response = await broken({ prompt: "cat" });
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /secret|private prompt/);
});
test("OpenAI adapter uses documented generation and image edit endpoints, transparent PNG and server-only auth", async () => {
  for (const reference of [undefined, image]) {
    const result = await openAIImage(
      { prompt: "one sticker", reference },
      {
        apiKey: "server-secret",
        request: async (url, init) => {
          assert.equal(
            url,
            `https://api.openai.com/v1/images/${reference ? "edits" : "generations"}`,
          );
          assert.equal(init.headers.Authorization, "Bearer server-secret");
          const body = JSON.parse(init.body);
          assert.equal(body.background, "transparent");
          assert.equal(body.n, 1);
          assert.equal(body.output_format, "png");
          if (reference)
            assert.deepEqual(body.images, [{ image_url: reference }]);
          else assert.equal(body.images, undefined);
          return new Response(
            JSON.stringify({ data: [{ b64_json: image.split(",")[1] }] }),
          );
        },
      },
    );
    assert.equal(result.image, image);
  }
});
test("invalid outputs and oversized prompts are rejected", async () => {
  assert.throws(() => validateRequest({ prompt: "x".repeat(4001) }));
  await assert.rejects(
    openAIImage(
      { prompt: "cat" },
      {
        request: async () =>
          new Response(
            JSON.stringify({ data: [{ url: "https://untrusted.test" }] }),
          ),
      },
    ),
    /unreadable/,
  );
});

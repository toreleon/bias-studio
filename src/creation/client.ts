export const generationURL =
  process.env.EXPO_PUBLIC_GENERATION_URL?.replace(/\/$/, "") || "";
export type GenerationRequest = { prompt: string; reference?: string };
export type GenerationResult = { image: string; model: string };
export async function generateImage(
  url: string,
  token: string,
  body: GenerationRequest,
  signal: AbortSignal,
  request: typeof fetch = fetch,
): Promise<GenerationResult> {
  if (
    !/^https:\/\//.test(url) &&
    !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)
  )
    throw new Error("Generation needs a secure service connection.");
  const response = await request(`${url}/v1/stickers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const messages: Record<number, string> = {
      401: "Your studio access code was not accepted. Reconnect and try again.",
      422: "This idea could not be generated. Adjust the description and try again.",
      429: "Generation is at its limit. Your results are safe; try again later.",
      503: "The generation service is not ready. Your brief is saved; try again later.",
      504: "Generation took too long. Your results are safe. A retry may incur another generation charge.",
    };
    throw new Error(
      messages[response.status] ||
        "Generation failed. Your existing results are safe. Try again when the service is available.",
    );
  }
  const result = await response.json();
  if (
    typeof result.image !== "string" ||
    result.image.length > 12 * 1024 * 1024 ||
    !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(result.image) ||
    typeof result.model !== "string" ||
    result.model.length > 120
  )
    throw new Error(
      "The service returned an unreadable result. Your existing results are safe.",
    );
  return result;
}

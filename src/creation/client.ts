import { betaCreatorId, betaRequest } from "../beta/client";
import { GenerationAttempt, JobStatus, jobStatuses } from "./model";

export const generationURL =
  process.env.EXPO_PUBLIC_GENERATION_URL?.replace(/\/$/, "") || "";
export type GenerationRequest = { prompt: string; reference?: string };
export type GenerationResult = { image: string; model: string };
export type GenerationJob = {
  id: string;
  requestId: string;
  status: JobStatus;
  result?: GenerationResult;
  error?: { code: string; message: string };
  resultExpired?: boolean;
};
type Request = <T>(path: string, options?: { method?: string; body?: unknown; signal?: AbortSignal }) => Promise<T>;
export function validateJob(value: unknown): GenerationJob {
  const job = value as GenerationJob;
  if (!job || typeof job.id !== "string" || !/^[A-Za-z0-9_-]{1,120}$/.test(job.id) ||
    typeof job.requestId !== "string" || !jobStatuses.includes(job.status) ||
    (job.status === "succeeded" && !job.resultExpired && (!job.result || !validResult(job.result))))
    throw new Error("The service returned an unreadable job. Recover the saved request to check its status.");
  return job;
}
function validResult(result: GenerationResult) {
  return typeof result.image === "string" && result.image.length <= 12 * 1024 * 1024 &&
    /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(result.image) &&
    typeof result.model === "string" && result.model.length <= 120;
}
/** Replaying this immutable request is safe, including after a lost POST response. */
export function assertAttemptOwner(attempt: GenerationAttempt, creatorId = betaCreatorId()) {
  if (!creatorId || !attempt.ownerId || attempt.ownerId !== creatorId)
    throw new Error("Reconnect the creator account that started this request. Recovery cannot create a charge under another account.");
}
export async function submitGeneration(attempt: GenerationAttempt, signal?: AbortSignal, request: Request = betaRequest, creatorId = betaCreatorId()) {
  assertAttemptOwner(attempt, creatorId);
  const job = validateJob(await request("/v1/jobs", { method: "POST", signal,
    body: { requestId: attempt.requestId, prompt: attempt.prompt, ...(attempt.reference ? { reference: attempt.reference } : {}) },
  }));
  if (job.requestId !== attempt.requestId) throw new Error("The service returned a different request. Your draft is unchanged.");
  return job;
}
/** Known jobs are read, never resubmitted. Legacy requests without ownership need a known server job. */
export async function recoverGeneration(attempt: GenerationAttempt, signal?: AbortSignal, request: Request = betaRequest, creatorId = betaCreatorId()) {
  if (!creatorId || (attempt.ownerId && attempt.ownerId !== creatorId))
    throw new Error("Reconnect the creator account that started this request. No generation request was sent.");
  if (!attempt.jobId) {
    if (!attempt.ownerId) throw new Error("This older request has no account or job identity. Contact the beta operator to recover it; starting another request may charge again.");
    return submitGeneration(attempt, signal, request, creatorId);
  }
  const job = await readGeneration(attempt.jobId, signal, request);
  if (job.requestId !== attempt.requestId || job.id !== attempt.jobId)
    throw new Error("The service returned a different request. No new generation was started.");
  return job;
}
export async function readGeneration(id: string, signal?: AbortSignal, request: Request = betaRequest) {
  return validateJob(await request(`/v1/jobs/${encodeURIComponent(id)}`, { signal }));
}
export async function cancelGeneration(id: string, request: Request = betaRequest) {
  return validateJob(await request(`/v1/jobs/${encodeURIComponent(id)}/cancel`, { method: "POST" }));
}
export async function markGenerationKept(id: string, request: Request = betaRequest) {
  await request(`/v1/jobs/${encodeURIComponent(id)}/kept`, { method: "POST", body: { kept: true } });
}
export async function markAttemptKept(attempt: GenerationAttempt, request: Request = betaRequest, creatorId = betaCreatorId()) {
  assertAttemptOwner(attempt, creatorId);
  if (!attempt.jobId) throw new Error("Recover this job before reporting it as kept.");
  return markGenerationKept(attempt.jobId, request);
}
export type GenerationUsage = { quota: number; remainingToday: number; attemptsToday: number; kept: number };
export async function generationUsage(request: Request = betaRequest): Promise<GenerationUsage> {
  const usage = await request<GenerationUsage>("/v1/usage");
  if (![usage.quota, usage.remainingToday, usage.attemptsToday, usage.kept].every((n) => Number.isFinite(n) && n >= 0))
    throw new Error("Allowance is unavailable. The service still enforces your beta limit.");
  return usage;
}
export function pollDelay(signal: AbortSignal, ms = 1500) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new Error("Monitoring paused.")); return; }
    const onAbort = () => { clearTimeout(timer); reject(new Error("Monitoring paused.")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
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

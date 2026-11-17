export const betaURL = (process.env.EXPO_PUBLIC_BETA_URL || process.env.EXPO_PUBLIC_GENERATION_URL || "").replace(/\/$/, "");
let session: { token: string; expiresAt: number; creatorId: string } | undefined;
export function betaConnected() { return !!session && session.expiresAt > Date.now(); }
export function betaCreatorId() { return betaConnected() ? session!.creatorId : undefined; }
export function disconnectBeta() { session = undefined; }
export class BetaError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function betaRequest<T>(path: string, options: {
  method?: string; body?: unknown; signal?: AbortSignal;
} = {}): Promise<T> {
  if (!/^https:\/\//.test(betaURL) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(betaURL))
    throw new BetaError(503, "Connect a secure beta service before using online features. Local packs are safe.");
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Invalid service path.");
  const response = await fetch(`${betaURL}${path}`, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json", ...(betaConnected() ? { Authorization: `Bearer ${session!.token}` } : {}) },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    signal: options.signal,
  });
  if (!response.ok) {
    if (response.status === 401) disconnectBeta();
    const messages: Record<number, string> = {
      400: "Check the pack or request details and try again.",
      401: "Sign in again with your creator invite. Saved drafts are safe.",
      403: "This action is not available for your account.",
      404: "This pack or job is unavailable. It may have been unpublished.",
      409: "This operation conflicts with an earlier request. Refresh its status before retrying.",
      413: "This upload is too large. Try a smaller pack.",
      422: "The provider could not accept this request. Adjust it before making another attempt.",
      429: "Your beta allowance or service limit is reached. Saved work remains available.",
      503: "The beta service is unavailable. Reconnect to recover your existing work.",
    };
    throw new BetaError(response.status, messages[response.status] || "The request did not finish. Check its status before trying again.");
  }
  return response.status === 204 ? undefined as T : response.json();
}
export async function connectBeta(code: string): Promise<void> {
  if (!code.trim() || code.trim().startsWith("sk-")) throw new Error("Use a creator invite, never a provider API key.");
  const result = await betaRequest<{token:string;expiresAt:number;creator:{id:string}}>("/v1/session", {method:"POST",body:{code:code.trim()}});
  if (typeof result.token !== "string" || !result.token.startsWith("bs_sess_") || !Number.isFinite(result.expiresAt) ||
    result.expiresAt <= Date.now() || typeof result.creator?.id !== "string" || !/^[A-Za-z0-9_-]{1,120}$/.test(result.creator.id))
    throw new Error("The service returned an invalid session.");
  session = {token:result.token,expiresAt:result.expiresAt,creatorId:result.creator.id};
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { GenerationAttempt, generationTargets, newCreation, recoverableAttempts, reuseRecipe, validCreation } from "../src/creation/model";
import { cancelGeneration, markGenerationKept, markAttemptKept, pollDelay, recoverGeneration, submitGeneration, validateJob } from "../src/creation/client";
import { migrate, emptyWorkspace } from "../src/workspace";

const reference = "data:image/png;base64,iVBORw0KGgo=";
const attempt: GenerationAttempt = {
  requestId: "request-123456", ownerId: "creator-a", feeling: "love", prompt: "One cat sticker", reference,
  subject: "cat", look: "pop", caption: "love", status: "queued",
};
const job = { id: "job-123456", requestId: attempt.requestId, status: "running" };

test("lost submission response is recovered with the identical request ID and payload", async () => {
  const calls: unknown[] = [];
  const request = async <T>(_path: string, options?: { body?: unknown }): Promise<T> => {
    calls.push(options?.body);
    if (calls.length === 1) throw new TypeError("network disconnected after server accepted");
    return job as T;
  };
  await assert.rejects(submitGeneration(attempt, undefined, request, "creator-a"), /network/);
  const reopened = JSON.parse(JSON.stringify(attempt));
  const recovered = await recoverGeneration(reopened, undefined, request, "creator-a");
  assert.equal(recovered.id, job.id);
  assert.deepEqual(calls[0], calls[1]);
  assert.deepEqual(calls[1], { requestId: attempt.requestId, prompt: attempt.prompt, reference });
});

test("durable attempts survive migration; pending and unmaterialized success recover, terminal failures do not replay as new work", () => {
  const draft = { ...newCreation(), attempts: [attempt] };
  const reopened = migrate(JSON.parse(JSON.stringify({ ...emptyWorkspace(), creations: [draft] }))).creations![0];
  assert.deepEqual(recoverableAttempts(reopened), [attempt]);
  reopened.attempts![0].status = "succeeded";
  assert.equal(recoverableAttempts(reopened).length, 1);
  reopened.candidates.push({ id: "candidate-1", uri: reference, caption: "", feeling: "love", selected: true,
    attemptId: attempt.requestId, provenance: { kind: "generated", prompt: "cat", look: "pop", feeling: "love" } });
  assert.equal(recoverableAttempts(reopened).length, 0);
  for (const status of ["failed", "cancelled", "interrupted"] as const) {
    reopened.candidates = [];
    reopened.attempts![0].status = status;
    assert.equal(recoverableAttempts(reopened).length, 0);
  }
  assert.ok(validCreation(reopened));
  assert.equal(validCreation({ ...draft, attempts: [attempt, attempt] }), false);
  assert.equal(validCreation({ ...draft, attempts: [{ ...attempt, reference: "https://tracking.test/image" }] }), false);
});

test("one sample is generated until explicit approval; recipe reuse starts approval and job state fresh", () => {
  const draft = newCreation();
  assert.deepEqual(generationTargets(draft, ["love", "hype", "cry"]), ["love"]);
  draft.candidates.push({ id: "sample-1", uri: reference, caption: "", feeling: "love", selected: true,
    provenance: { kind: "generated", prompt: "cat", look: "pop", feeling: "love" } });
  assert.deepEqual(generationTargets(draft, ["hype", "cry"]), ["hype"]);
  draft.approvedSampleId = "sample-1";
  draft.attempts = [attempt];
  assert.deepEqual(generationTargets(draft, ["hype", "cry"]), ["hype", "cry"]);
  const reused = reuseRecipe(draft);
  assert.equal(reused.approvedSampleId, undefined);
  assert.equal(reused.attempts, undefined);
});

test("job validation rejects remote result URLs and mismatched request identity", async () => {
  assert.throws(() => validateJob({ ...job, status: "succeeded", result: { image: "https://tracking.test/a.png", model: "test" } }), /unreadable/);
  await assert.rejects(submitGeneration(attempt, undefined, async <T>() => ({ ...job, requestId: "someone-else" }) as T, "creator-a"), /different request/);
});

test("switching accounts cannot replay a paid request, retrieve it, or report a kept result", async () => {
  let calls = 0;
  const request = async <T>() => { calls++; return job as T; };
  await assert.rejects(recoverGeneration(attempt, undefined, request, "creator-b"), /Reconnect the creator account/);
  await assert.rejects(recoverGeneration({ ...attempt, jobId: job.id }, undefined, request, "creator-b"), /Reconnect the creator account/);
  await assert.rejects(submitGeneration(attempt, undefined, request, "creator-b"), /another account/);
  await assert.rejects(markAttemptKept({ ...attempt, jobId: job.id }, request, "creator-b"), /another account/);
  assert.equal(calls, 0);
});

test("legacy unknown-owner attempts only recover with an authenticated GET of a known job; missing identity never POSTs", async () => {
  const legacy = { ...attempt, ownerId: undefined };
  const calls: { path: string; method?: string }[] = [];
  const request = async <T>(path: string, options?: { method?: string }) => {
    calls.push({ path, method: options?.method }); return job as T;
  };
  await assert.rejects(recoverGeneration(legacy, undefined, request, "creator-a"), /Contact the beta operator/);
  assert.equal(calls.length, 0);
  await recoverGeneration({ ...legacy, jobId: job.id }, undefined, request, "creator-a");
  assert.deepEqual(calls, [{ path: `/v1/jobs/${job.id}`, method: undefined }]);
  assert.ok(validCreation({ ...newCreation(), attempts: [legacy] }));
});

test("expired server results remain terminal without blocking a separately confirmed new variation", () => {
  const expired = validateJob({ ...job, status: "succeeded", resultExpired: true });
  assert.equal(expired.result, undefined);
  const draft = { ...newCreation(), attempts: [{ ...attempt, status: "succeeded" as const, resultExpired: true }] };
  assert.ok(validCreation(draft));
  assert.deepEqual(recoverableAttempts(draft), []);
});

test("cancellation is a server operation; kept reporting is a separate explicit operation", async () => {
  const paths: string[] = [];
  const bodies: unknown[] = [];
  const request = async <T>(path: string, options?: { body?: unknown }) => {
    paths.push(path); bodies.push(options?.body);
    return { ...job, status: "cancelled" } as T;
  };
  assert.equal((await cancelGeneration(job.id, request)).status, "cancelled");
  await markGenerationKept(job.id, request);
  assert.deepEqual(paths, [`/v1/jobs/${job.id}/cancel`, `/v1/jobs/${job.id}/kept`]);
  assert.deepEqual(bodies, [undefined, { kept: true }]);
  const controller = new AbortController();
  const waiting = pollDelay(controller.signal, 10000);
  controller.abort();
  await assert.rejects(waiting, /paused/);
});

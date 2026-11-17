import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBetaStore, digest } from '../server/beta-store.mjs';
import { createGenerationService } from '../server/beta-generation.mjs';
import { ServiceError } from '../server/generation.mjs';

const result = { image: 'data:image/png;base64,iVBORw0KGgo=', model: 'test-image-model', usage: { total_tokens: 42, input_tokens_details: { text_tokens: 10 }, private_prompt: 'never store me' } };
const payload = (id = 'request_0001') => ({ requestId: id, prompt: 'A joyful reaction' });
function setup(t, options = {}, generate = async () => result) {
  const directory = mkdtempSync(join(tmpdir(), 'bias-beta-'));
  const filename = join(directory, 'beta.sqlite');
  const store = createBetaStore({ filename, ...options });
  const invite = store.createInvite({ label: 'Creator A' });
  const owner = store.authenticate(store.exchangeInvite(invite.code).token);
  const service = createGenerationService({ store, generate });
  t.after(async () => { await service.close(); store.close(); rmSync(directory, { recursive: true, force: true }); });
  return { filename, store, service, owner, invite };
}
const status = (code) => (error) => error.status === code;

test('invite reusable; sessions are opaque, hashed, expiring and independently revocable', (t) => {
  let time = Date.UTC(2026, 0, 1);
  const { store, invite, filename } = setup(t, { now: () => time, sessionTtlMs: 1000 });
  const first = store.exchangeInvite(invite.code);
  const second = store.exchangeInvite(invite.code);
  assert.notEqual(first.token, second.token);
  assert.equal(store.authenticate(second.token).id, invite.creator.id);
  assert.equal(store.db.prepare('SELECT invite_hash FROM beta_creators').get().invite_hash, digest(invite.code));
  store.revokeSession(first.token);
  assert.throws(() => store.authenticate(first.token), status(401));
  assert.equal(store.authenticate(second.token).id, invite.creator.id);
  assert.throws(() => store.exchangeInvite('bad-code'), status(401));
  time += 1000;
  assert.throws(() => store.authenticate(second.token), status(401));
  store.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  const bytes = readFileSync(filename).toString();
  assert.ok(!bytes.includes(invite.code));
  assert.ok(!bytes.includes(first.token));
  assert.ok(!bytes.includes(second.token));
});

test('idempotency survives completion, keeps inputs private and rejects changed payload', async (t) => {
  let calls = 0;
  const { service, store, owner } = setup(t, {}, async () => { calls++; return result; });
  const input = { ...payload(), reference: 'data:image/png;base64,cHJpdmF0ZQ==' };
  const first = service.submit(owner, input);
  const duplicate = service.submit(owner, input);
  assert.equal(first.id, duplicate.id);
  assert.equal(first.status, 'queued');
  assert.ok(!JSON.stringify(first).includes('reference'));
  assert.throws(() => service.submit(owner, { ...input, prompt: 'different' }), status(409));
  await service.waitForIdle();
  const completed = service.get(owner, first.id);
  assert.equal(completed.status, 'succeeded');
  assert.deepEqual(completed.result.usage, { total_tokens: 42, input_tokens_details: { text_tokens: 10 } });
  assert.equal(store.db.prepare('SELECT input_json FROM beta_generation_jobs').get().input_json, null);
  assert.equal(service.submit(owner, input).id, first.id);
  await service.waitForIdle();
  assert.equal(calls, 1);
  assert.ok(!JSON.stringify(completed).includes('A joyful'));
});

test('owners cannot inspect, cancel or retain another creator job', async (t) => {
  const { service, store, owner } = setup(t);
  const other = store.createInvite({ label: 'Creator B' }).creator;
  const job = service.submit(owner, payload());
  for (const action of [() => service.get(other, job.id), () => service.cancel(other, job.id), () => service.markKept(other, job.id, true)]) assert.throws(action, status(404));
  assert.throws(() => service.submit({ id: 'forged' }, payload()), status(401));
  await service.waitForIdle();
  assert.equal(service.usage(other).attempts, 0);
});

test('durable daily quotas and global reservation budget reserve atomically before dispatch', async (t) => {
  const { service, store, owner } = setup(t, { defaultQuota: 2, maxDailyAttempts: 4, reservationMicros: 50, maxDailyReservedMicros: 150 });
  service.submit(owner, payload('request_0001'));
  service.submit(owner, payload('request_0002'));
  assert.throws(() => service.submit(owner, payload('request_0003')), status(429));
  const second = store.createInvite({ label: 'Second' }).creator;
  service.submit(second, payload('request_0001'));
  assert.throws(() => service.submit(second, payload('request_0002')), status(429));
  assert.equal(service.usage(owner).attemptsToday, 2);
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM beta_generation_jobs').get().n, 3);
  await service.waitForIdle();
});

test('global attempt limit is independent of estimate budget; UTC reset preserves lifetime metrics', async (t) => {
  let time = Date.UTC(2026, 0, 1, 23, 59);
  const { service, store, owner } = setup(t, { now: () => time, maxDailyAttempts: 1 });
  service.submit(owner, payload());
  const second = store.createInvite({ label: 'Second' }).creator;
  assert.throws(() => service.submit(second, payload()), status(429));
  await service.waitForIdle();
  time += 120000;
  service.submit(owner, payload('request_0002'));
  await service.waitForIdle();
  assert.equal(service.usage(owner).attemptsToday, 1);
  assert.equal(service.usage(owner).attempts, 2);
});

test('cancel before dispatch never calls provider; failed and uncertain requests retain reservations', async (t) => {
  let calls = 0;
  const { service, owner } = setup(t, {}, async (input) => {
    calls++;
    if (input.prompt === 'refused') throw new ServiceError(422, 'Provider private details');
    throw new Error('network reset with private body');
  });
  const cancelled = service.submit(owner, payload());
  assert.equal(service.cancel(owner, cancelled.id).status, 'cancelled');
  await service.waitForIdle();
  assert.equal(calls, 0);
  const failed = service.submit(owner, { ...payload('request_0002'), prompt: 'refused' });
  const uncertain = service.submit(owner, payload('request_0003'));
  await service.waitForIdle();
  assert.equal(service.get(owner, failed.id).status, 'failed');
  assert.equal(service.get(owner, uncertain.id).status, 'interrupted');
  assert.ok(!JSON.stringify(service.get(owner, uncertain.id)).includes('private'));
  assert.equal(service.usage(owner).reservedEstimateMicros, 150000);
  assert.throws(() => service.markKept(owner, failed.id, true), status(409));
});

test('cancel during paid request and late provider response cannot resurrect cancelled job', async (t) => {
  let resolve;
  const { service, owner } = setup(t, {}, () => new Promise((done) => { resolve = done; }));
  const job = service.submit(owner, payload());
  await new Promise((done) => setImmediate(done));
  assert.equal(service.get(owner, job.id).status, 'running');
  service.cancel(owner, job.id);
  await service.waitForIdle();
  resolve(result);
  await new Promise((done) => setImmediate(done));
  assert.equal(service.get(owner, job.id).status, 'cancelled');
  assert.equal(service.usage(owner).reservedEstimateMicros, 50000);
});

test('timeout is uncertain, does not retry and keeps the reservation', async (t) => {
  const { store, owner, service: original } = setup(t);
  await original.close();
  let calls = 0;
  const service = createGenerationService({ store, timeoutMs: 5, generate: () => { calls++; return new Promise(() => {}); } });
  t.after(() => service.close());
  const job = service.submit(owner, payload());
  await service.waitForIdle();
  assert.equal(service.get(owner, job.id).status, 'interrupted');
  service.submit(owner, payload());
  await service.waitForIdle();
  assert.equal(calls, 1);
});

test('restart preserves auth, output, idempotency and quota; never replays dispatched requests', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bias-restart-'));
  const filename = join(directory, 'beta.sqlite');
  let store;
  let service;
  try {
    store = createBetaStore({ filename });
    const invite = store.createInvite({ label: 'Durable', quota: 3 });
    const session = store.exchangeInvite(invite.code);
    const owner = session.creator;
    service = createGenerationService({ store, generate: async () => result });
    const completed = service.submit(owner, payload());
    await service.waitForIdle();
    await service.close();
    // Simulate persisted queued work and a process dying after dispatch, without provider retry.
    service = createGenerationService({ store, generate: async () => result });
    const queued = service.submit(owner, payload('request_0002'));
    const running = service.submit(owner, payload('request_0003'));
    await service.close();
    store.db.prepare("UPDATE beta_generation_jobs SET status='running',started_at=? WHERE id=?").run(Date.now(), running.id);
    store.close();
    store = createBetaStore({ filename });
    let calls = 0;
    service = createGenerationService({ store, generate: async () => { calls++; return result; } });
    assert.equal(store.authenticate(session.token).id, owner.id);
    assert.equal(service.get(owner, completed.id).result.image, result.image);
    assert.equal(service.get(owner, running.id).status, 'interrupted');
    assert.equal(service.submit(owner, payload('request_0003')).id, running.id);
    await service.waitForIdle();
    assert.equal(calls, 1);
    assert.equal(service.get(owner, queued.id).status, 'succeeded');
    assert.equal(service.usage(owner).attempts, 3);
    assert.throws(() => service.submit(owner, payload('request_0004')), status(429));
  } finally {
    if (service) await service.close();
    if (store) store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('kept metrics are idempotent and reversible; reservations are explicitly estimates', async (t) => {
  const { service, owner } = setup(t);
  const first = service.submit(owner, payload());
  service.submit(owner, payload('request_0002'));
  await service.waitForIdle();
  service.markKept(owner, first.id, true);
  service.markKept(owner, first.id, true);
  assert.equal(service.usage(owner).kept, 1);
  assert.equal(service.usage(owner).reservedEstimateMicrosPerKept, 100000);
  assert.equal(service.usage(owner).estimateIsActualSpend, false);
  service.markKept(owner, first.id, false);
  assert.equal(service.usage(owner).reservedEstimateMicrosPerKept, null);
});

test('provider usage adapter retains documented counters without arbitrary provider content', async () => {
  const { openAIImage } = await import('../server/generation.mjs');
  const generated = await openAIImage({ prompt: 'sample' }, {
    apiKey: 'unused-mock-key',
    request: async () => new Response(JSON.stringify({
      data: [{ b64_json: 'iVBORw0KGgo=' }],
      usage: { total_tokens: 42, input_tokens: 12, output_tokens: 30,
        input_tokens_details: { image_tokens: 10, text_tokens: 2, private_text: 'never retain' },
        account: 'never retain', misleading_cost: 500 },
    })),
  });
  assert.deepEqual(generated.usage, { total_tokens: 42, input_tokens: 12, output_tokens: 30, input_tokens_details: { image_tokens: 10, text_tokens: 2 } });
});

test('closing between queued acquisition and provider dispatch cannot cause a paid call', async (t) => {
  let calls = 0;
  const { service, owner } = setup(t, {}, async () => { calls++; return result; });
  const job = service.submit(owner, payload());
  // pump is queued before this microtask; provider dispatch is queued after it.
  await new Promise((resolve) => queueMicrotask(() => { void service.close().then(resolve); }));
  assert.equal(calls, 0);
  assert.equal(service.get(owner, job.id).status, 'interrupted');
});

test('disabled generation recovers existing requests without reserving or dispatching new attempts', async (t) => {
  let calls = 0;
  const { service, owner } = setup(t, {}, async () => { calls++; return result; });
  const original = service.submit(owner, payload());
  await service.waitForIdle();
  const before = service.usage(owner);
  const recovered = service.submit(owner, payload(), {allowNew:false});
  assert.equal(recovered.id, original.id);
  assert.equal(recovered.status, 'succeeded');
  assert.equal(recovered.result.image, result.image);
  assert.throws(() => service.submit(owner, payload('request_disabled'), {allowNew:false}), status(503));
  assert.throws(() => service.submit(owner, {...payload(),prompt:'changed'}, {allowNew:false}), status(409));
  await service.waitForIdle();
  assert.equal(calls, 1);
  assert.deepEqual(service.usage(owner), before);
});

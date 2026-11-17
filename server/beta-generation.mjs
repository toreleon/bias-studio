import { randomUUID } from 'node:crypto';
import { digest } from './beta-store.mjs';
import { ServiceError, validateRequest } from './generation.mjs';

const terminal = new Set(['succeeded', 'failed', 'cancelled', 'interrupted']);
const messages = {
  interrupted: 'The provider may have processed this request. It will not be retried automatically.',
  failed: 'Generation could not complete. Adjust the request before creating a new attempt.',
  cancelled: 'Cancelled. A request already sent to the provider may still incur cost.',
};
function publicJob(row) {
  return {
    id: row.id, requestId: row.request_id, status: row.status, kept: !!row.kept,
    createdAt: row.created_at, startedAt: row.started_at, finishedAt: row.finished_at,
    reservedEstimateMicros: row.reservation_micros,
    ...(row.result_json ? { result: JSON.parse(row.result_json) } : {}),
    ...(row.status === 'succeeded' && !row.result_json ? { resultExpired: true } : {}),
    ...(row.error_code ? { error: { code: row.error_code, message: messages[row.error_code] } } : {}),
  };
}
// Only numeric usage counters are retained; arbitrary provider text is never persisted or returned.
export function numericUsage(input, depth = 0) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || depth > 3) return undefined;
  const output = {};
  for (const [key, value] of Object.entries(input).slice(0, 30)) {
    if (!/^[a-z_]{1,60}$/.test(key)) continue;
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) output[key] = value;
    else if (typeof value === 'object') {
      const nested = numericUsage(value, depth + 1);
      if (nested && Object.keys(nested).length) output[key] = nested;
    }
  }
  return Object.keys(output).length ? output : undefined;
}

/** One worker per SQLite database. HTTP disconnects must not close this service. */
export function createGenerationService({ store, generate, concurrency = 2, timeoutMs = 150000 } = {}) {
  if (!store || typeof generate !== 'function') throw new Error('store and generate are required.');
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 20) throw new Error('Invalid concurrency.');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new Error('Invalid timeoutMs.');
  const { db, now, limits } = store;
  const running = new Map();
  let closed = false;
  let scheduled = false;
  const idleWaiters = [];
  // A running request could have been paid for before process death. Never replay it.
  db.prepare("UPDATE beta_generation_jobs SET status='interrupted',error_code='interrupted',input_json=NULL,finished_at=? WHERE status='running'").run(now());
  function owned(owner, id) {
    const account = store.creator(owner);
    const row = db.prepare('SELECT * FROM beta_generation_jobs WHERE id=? AND creator_id=?').get(id, account.id);
    if (!row) throw new ServiceError(404, 'Generation not found.');
    return row;
  }
  function get(owner, id) { return publicJob(owned(owner, id)); }
  function submit(owner, body, { allowNew = true } = {}) {
    if (closed) throw new ServiceError(503, 'Generation worker is stopping.');
    const account = store.creator(owner);
    const requestId = body?.requestId;
    if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{8,120}$/.test(requestId)) throw new ServiceError(400, 'Use a stable request ID of 8–120 letters, numbers, underscores or hyphens.');
    const input = validateRequest(body);
    const inputJson = JSON.stringify(input);
    const hash = digest(inputJson);
    const job = store.transaction(() => {
      const existing = db.prepare('SELECT * FROM beta_generation_jobs WHERE creator_id=? AND request_id=?').get(account.id, requestId);
      if (existing) {
        if (existing.payload_hash !== hash) throw new ServiceError(409, 'This request ID was already used with different content.');
        return publicJob(existing);
      }
      if (!allowNew) throw new ServiceError(503, 'Generation is not configured. Saved requests can still be recovered.');
      const timestamp = now();
      const day = new Date(timestamp).toISOString().slice(0, 10);
      const total = db.prepare('SELECT COUNT(*) AS attempts,COALESCE(SUM(reservation_micros),0) AS reserved FROM beta_generation_jobs WHERE day=?').get(day);
      const own = db.prepare('SELECT COUNT(*) AS attempts FROM beta_generation_jobs WHERE day=? AND creator_id=?').get(day, account.id);
      if (own.attempts >= account.quota) throw new ServiceError(429, 'Your daily generation allowance is used. Saved work is still available.');
      if (total.attempts >= limits.maxDailyAttempts || total.reserved > limits.maxDailyReservedMicros - limits.reservationMicros)
        throw new ServiceError(429, 'The beta daily generation budget is reserved. Try tomorrow.');
      const id = randomUUID();
      db.prepare(`INSERT INTO beta_generation_jobs(id,creator_id,request_id,payload_hash,status,input_json,reservation_micros,day,created_at)
        VALUES(?,?,?,?,'queued',?,?,?,?)`).run(id, account.id, requestId, hash, inputJson, limits.reservationMicros, day, timestamp);
      return publicJob(db.prepare('SELECT * FROM beta_generation_jobs WHERE id=?').get(id));
    });
    schedule();
    return job;
  }
  function finish(id, status, result = null) {
    db.prepare(`UPDATE beta_generation_jobs SET status=?,result_json=?,error_code=?,input_json=NULL,finished_at=? WHERE id=? AND status='running'`)
      .run(status, result ? JSON.stringify(result) : null, status === 'succeeded' ? null : status, now(), id);
  }
  async function execute(row, controller) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, timeoutMs);
      controller.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
    try {
      const result = await Promise.race([Promise.resolve().then(() => {
        if (controller.signal.aborted) throw new Error('aborted before dispatch');
        return generate(JSON.parse(row.input_json), { signal: controller.signal });
      }), timeout]);
      if (typeof result?.image !== 'string' || result.image.length > 17 * 1024 * 1024 || !/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]*$/.test(result.image) || typeof result.model !== 'string' || result.model.length > 120)
        throw new Error('Invalid provider output');
      const usage = numericUsage(result.usage);
      finish(row.id, 'succeeded', { image: result.image, model: result.model, ...(usage ? { usage } : {}) });
    } catch (error) {
      // Only explicit validation/refusal errors prove failure. Transport errors remain uncertain.
      finish(row.id, error instanceof ServiceError && [400, 422, 429].includes(error.status) ? 'failed' : 'interrupted');
    } finally {
      clearTimeout(timer);
      running.delete(row.id);
      if (!closed) schedule();
      settleIdle();
    }
  }
  function pump() {
    scheduled = false;
    if (closed) return;
    while (running.size < concurrency) {
      const row = store.transaction(() => {
        const candidate = db.prepare("SELECT * FROM beta_generation_jobs WHERE status='queued' ORDER BY created_at,id LIMIT 1").get();
        if (!candidate) return null;
        db.prepare("UPDATE beta_generation_jobs SET status='running',started_at=? WHERE id=? AND status='queued'").run(now(), candidate.id);
        return candidate;
      });
      if (!row) break;
      const controller = new AbortController();
      running.set(row.id, controller);
      void execute(row, controller);
    }
    settleIdle();
  }
  function schedule() {
    if (!closed && !scheduled) { scheduled = true; queueMicrotask(pump); }
  }
  function settleIdle() {
    if (!running.size && (closed || !db.prepare("SELECT 1 FROM beta_generation_jobs WHERE status='queued' LIMIT 1").get())) {
      idleWaiters.splice(0).forEach((resolve) => resolve());
    }
  }
  function waitForIdle() {
    return new Promise((resolve) => { idleWaiters.push(resolve); settleIdle(); });
  }
  function cancel(owner, id) {
    const row = owned(owner, id);
    if (!terminal.has(row.status)) {
      db.prepare("UPDATE beta_generation_jobs SET status='cancelled',error_code='cancelled',input_json=NULL,finished_at=? WHERE id=? AND status IN ('queued','running')").run(now(), id);
      running.get(id)?.abort();
      settleIdle();
    }
    return get(owner, id);
  }
  function markKept(owner, id, kept) {
    const row = owned(owner, id);
    if (typeof kept !== 'boolean') throw new ServiceError(400, 'kept must be a boolean.');
    if (row.status !== 'succeeded') throw new ServiceError(409, 'Only completed images can be marked as kept.');
    db.prepare('UPDATE beta_generation_jobs SET kept=? WHERE id=?').run(kept ? 1 : 0, id);
    return get(owner, id);
  }
  function usage(owner) {
    const account = store.creator(owner);
    const day = new Date(now()).toISOString().slice(0, 10);
    const today = db.prepare('SELECT COUNT(*) AS attempts,COALESCE(SUM(reservation_micros),0) AS reserved FROM beta_generation_jobs WHERE creator_id=? AND day=?').get(account.id, day);
    const lifetime = db.prepare(`SELECT COUNT(*) AS attempts,COALESCE(SUM(reservation_micros),0) AS reserved,
      COALESCE(SUM(kept),0) AS kept,COALESCE(SUM(status='succeeded'),0) AS succeeded FROM beta_generation_jobs WHERE creator_id=?`).get(account.id);
    return {
      day, quota: account.quota, attemptsToday: today.attempts, remainingToday: Math.max(0, account.quota - today.attempts),
      reservedEstimateMicrosToday: today.reserved, attempts: lifetime.attempts, succeeded: lifetime.succeeded, kept: lifetime.kept,
      reservedEstimateMicros: lifetime.reserved,
      reservedEstimateMicrosPerKept: lifetime.kept ? Math.ceil(lifetime.reserved / lifetime.kept) : null,
      estimateCurrency: 'USD', estimateIsActualSpend: false,
      estimateNote: 'Conservative configured reservation, including failed, cancelled and uncertain attempts. Verify actual billing with the provider.',
    };
  }
  async function close() {
    closed = true;
    for (const [id, controller] of running) { finish(id, 'interrupted'); controller.abort(); }
    await waitForIdle();
  }
  schedule();
  return { submit, get, cancel, markKept, usage, waitForIdle, close };
}

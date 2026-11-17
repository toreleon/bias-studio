import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { ServiceError } from './generation.mjs';

export const digest = (value) => createHash('sha256').update(value).digest('hex');
export const ownerId = (owner) => typeof owner === 'string' ? owner : owner?.id;
const secret = (prefix) => prefix + randomBytes(32).toString('base64url');
const integer = (value, name, min = 1) => {
  if (!Number.isSafeInteger(value) || value < min) throw new Error(`${name} must be a safe integer >= ${min}.`);
  return value;
};

/** Single-node durable beta storage. Mount filename's directory on persistent private storage. */
export function createBetaStore({
  filename, now = Date.now, sessionTtlMs = 7 * 86400000,
  defaultQuota = 20, maxDailyAttempts = 100,
  reservationMicros = 50000, maxDailyReservedMicros = 5000000,
} = {}) {
  if (typeof filename !== 'string' || !filename) throw new Error('A persistent SQLite filename is required.');
  const limits = {
    sessionTtlMs: integer(sessionTtlMs, 'sessionTtlMs'),
    defaultQuota: integer(defaultQuota, 'defaultQuota'),
    maxDailyAttempts: integer(maxDailyAttempts, 'maxDailyAttempts'),
    reservationMicros: integer(reservationMicros, 'reservationMicros'),
    maxDailyReservedMicros: integer(maxDailyReservedMicros, 'maxDailyReservedMicros'),
  };
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
  if (filename !== ':memory:') chmodSync(filename, 0o600);
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS beta_creators (
      id TEXT PRIMARY KEY, label TEXT NOT NULL, invite_hash TEXT UNIQUE NOT NULL,
      quota INTEGER NOT NULL CHECK(quota > 0), created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS beta_sessions (
      token_hash TEXT PRIMARY KEY, creator_id TEXT NOT NULL REFERENCES beta_creators(id),
      expires_at INTEGER NOT NULL, revoked_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS beta_generation_jobs (
      id TEXT PRIMARY KEY, creator_id TEXT NOT NULL REFERENCES beta_creators(id),
      request_id TEXT NOT NULL, payload_hash TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('queued','running','succeeded','failed','cancelled','interrupted')),
      input_json TEXT, result_json TEXT, error_code TEXT,
      kept INTEGER NOT NULL DEFAULT 0 CHECK(kept IN (0,1)),
      reservation_micros INTEGER NOT NULL, day TEXT NOT NULL,
      created_at INTEGER NOT NULL, started_at INTEGER, finished_at INTEGER,
      UNIQUE(creator_id, request_id)
    );
    CREATE INDEX IF NOT EXISTS beta_jobs_day ON beta_generation_jobs(day, creator_id);
    CREATE INDEX IF NOT EXISTS beta_jobs_status ON beta_generation_jobs(status, created_at);
  `);
  function transaction(action) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = action(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function creator(owner) {
    const id = ownerId(owner);
    const row = typeof id === 'string' && db.prepare('SELECT id,label,quota FROM beta_creators WHERE id=?').get(id);
    if (!row) throw new ServiceError(401, 'Sign in with your creator invite.');
    return { ...row };
  }
  function createInvite({ label, quota = defaultQuota } = {}) {
    if (typeof label !== 'string' || !label.trim() || label.length > 120) throw new ServiceError(400, 'Creator label must be 1–120 characters.');
    integer(quota, 'quota');
    const code = secret('bs_inv_');
    const account = { id: randomUUID(), label: label.trim(), quota };
    db.prepare('INSERT INTO beta_creators(id,label,invite_hash,quota,created_at) VALUES(?,?,?,?,?)')
      .run(account.id, account.label, digest(code), quota, now());
    return { creator: account, code };
  }
  function exchangeInvite(code) {
    const account = typeof code === 'string' && code.length <= 200 && db.prepare('SELECT id,label,quota FROM beta_creators WHERE invite_hash=?').get(digest(code));
    if (!account) throw new ServiceError(401, 'Invite code is not valid.');
    const token = secret('bs_sess_');
    const expiresAt = now() + sessionTtlMs;
    db.prepare('INSERT INTO beta_sessions(token_hash,creator_id,expires_at) VALUES(?,?,?)').run(digest(token), account.id, expiresAt);
    return { token, expiresAt, creator: { ...account } };
  }
  function authenticate(token) {
    const row = typeof token === 'string' && token.length <= 200 && db.prepare(`SELECT c.id,c.label,c.quota FROM beta_sessions s JOIN beta_creators c ON c.id=s.creator_id
      WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>?`).get(digest(token), now());
    if (!row) throw new ServiceError(401, 'Your session expired. Sign in again.');
    return { ...row };
  }
  function revokeSession(token) {
    if (typeof token === 'string' && token.length <= 200) db.prepare('UPDATE beta_sessions SET revoked_at=? WHERE token_hash=?').run(now(), digest(token));
  }
  return { db, now, limits, transaction, creator, createInvite, exchangeInvite, authenticate, revokeSession, close: () => db.close() };
}

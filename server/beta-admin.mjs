import { backup } from 'node:sqlite';
import { openSync, writeFileSync, fsyncSync, closeSync, unlinkSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createBetaStore, digest } from './beta-store.mjs';

export const HELP = `Bias Studio private beta administration (Node >=22.16)

  node server/beta-admin.mjs invite --label "Creator name" --output ./private-invite.json [--quota 20]
  node server/beta-admin.mjs backup --output ./private-backup.sqlite
  node server/beta-admin.mjs revoke --creator CREATOR_ID
  node server/beta-admin.mjs prune --before 2026-01-01T00:00:00Z

BETA_DB selects the database (default ./server/data/beta.sqlite).
Invite and backup outputs must not exist; files are created with mode 0600.
Invite codes are only written to the explicit output file, never stdout.
Revoke disables the reusable invite and all existing sessions for that creator.
Prune clears generation prompts/references/results only for terminal jobs older
than the explicit cutoff, which must be at least 30 days ago. Idempotency records,
quotas, status, retained counts and cost reservations remain. Local saved stickers
are unaffected. Expired/revoked sessions are also removed. Published packs are not
changed. Pruning is logical deletion: old database pages, WAL and backups may retain
bytes. Stop the service for offline SQLite VACUUM/checkpoint if physical reclamation
is required, and manage encrypted private backups under a separate retention policy.
Backup uses SQLite's consistent online backup API, including committed WAL data.
Keep the database, backups and invite files private; never put them in Git or images.
`;

function options(args) {
  const result = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]; const value = args[index + 1];
    if (!/^--[a-z]+$/.test(key || '') || value === undefined || value.startsWith('--') || key in result)
      throw new Error('Expected distinct --option value pairs. Use --help.');
    result[key] = value;
  }
  return result;
}
function allow(opts, keys) {
  if (Object.keys(opts).some(key => !keys.includes(key))) throw new Error('Unknown option. Use --help.');
}
async function privateOutput(filename, write) {
  if (typeof filename !== 'string' || !filename.trim()) throw new Error('An explicit --output path is required.');
  const fd = openSync(filename, 'wx', 0o600);
  try { await write(fd); fsyncSync(fd); }
  catch (error) { closeSync(fd); unlinkSync(filename); throw error; }
  closeSync(fd);
}

/** Injected options support local testing without touching the configured deployment database. */
export async function runAdmin(args, { filename = process.env.BETA_DB || './server/data/beta.sqlite', now = Date.now } = {}) {
  const [command, ...rest] = args;
  if (command === '--help' || command === 'help' || !command) return HELP;
  const opts = options(rest);
  if (!['invite', 'backup', 'revoke', 'prune'].includes(command)) throw new Error('Unknown command. Use --help.');
  if (command !== 'invite' && !existsSync(filename)) throw new Error('The configured database does not exist.');
  const store = createBetaStore({ filename, now });
  try {
    if (command === 'invite') {
      allow(opts, ['--label', '--output', '--quota']);
      if (typeof opts['--label'] !== 'string' || !opts['--label'].trim() || opts['--label'].length > 64) throw new Error('Creator label must contain 1–64 characters.');
      const quota = opts['--quota'] === undefined ? 20 : Number(opts['--quota']);
      if (!Number.isSafeInteger(quota) || quota < 1 || quota > 1000) throw new Error('Quota must be an integer from 1 to 1000.');
      await privateOutput(opts['--output'], async (fd) => {
        store.transaction(() => {
          const invite = store.createInvite({ label: opts['--label'], quota });
          writeFileSync(fd, JSON.stringify(invite, null, 2) + '\n', { encoding: 'utf8' });
          fsyncSync(fd);
        });
      });
      return 'Creator invite written to the private output file. The code is not printed.';
    }
    if (command === 'backup') {
      allow(opts, ['--output']);
      await privateOutput(opts['--output'], async () => { await backup(store.db, opts['--output']); });
      return 'Consistent database backup written to the private output file. Apply your backup retention policy.';
    }
    if (command === 'revoke') {
      allow(opts, ['--creator']);
      const account = store.creator(opts['--creator']);
      store.transaction(() => {
        store.db.prepare('UPDATE beta_creators SET invite_hash=? WHERE id=?').run(digest(randomBytes(32)), account.id);
        store.db.prepare('UPDATE beta_sessions SET revoked_at=? WHERE creator_id=? AND revoked_at IS NULL').run(now(), account.id);
      });
      return 'Creator invite and all existing sessions revoked. Pack ownership and usage records remain.';
    }
    allow(opts, ['--before']);
    const raw = opts['--before'];
    const cutoff = typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(raw) ? Date.parse(raw) : NaN;
    if (!Number.isFinite(cutoff) || cutoff > now() - 30 * 86400000) throw new Error('--before must be an explicit UTC timestamp at least 30 days ago.');
    const counts = store.transaction(() => {
      const jobs = store.db.prepare(`UPDATE beta_generation_jobs SET input_json=NULL,result_json=NULL
        WHERE status IN ('succeeded','failed','cancelled','interrupted') AND finished_at<? AND (input_json IS NOT NULL OR result_json IS NOT NULL)`).run(cutoff).changes;
      const sessions = store.db.prepare('DELETE FROM beta_sessions WHERE expires_at<=? OR revoked_at IS NOT NULL').run(now()).changes;
      return { jobs, sessions };
    });
    return `Logically pruned ${counts.jobs} terminal job payloads and ${counts.sessions} expired/revoked sessions. Idempotency, quota and cost ledgers remain. Old pages, WAL and backups may still retain bytes; see --help.`;
  } finally { store.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.umask(0o077);
  try { console.log(await runAdmin(process.argv.slice(2))); }
  catch (error) {
    // Filesystem/SQLite exception strings can contain private paths or SQL. Do not print them.
    const known = error?.constructor === Error && !('code' in error);
    console.error(known ? error.message : 'Administration failed. Check arguments, file permissions and database availability. Use --help.');
    process.exitCode = 1;
  }
}

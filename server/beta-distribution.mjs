import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

export class DistributionError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new DistributionError(status, message); };
const hash = value => createHash('sha256').update(value).digest('hex');
const own = (value, fields) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    Object.keys(value).some(key => !fields.includes(key))) fail(400, 'Only finished stickers and collection credit may be shared. Remove sources, prompts and editable design metadata.');
};
const cleanText = (value, limit, label) => {
  if (typeof value !== 'string' || !value.trim() || Array.from(value.trim()).length > limit || /[\u0000-\u001f\u007f]/u.test(value)) {
    fail(400, `${label} must contain 1–${limit} characters without control characters.`);
  }
  return value.trim();
};

/** Validate the RIFF envelope and encoded VP8/VP8L frame dimensions, not a claimed MIME or canvas size. */
export function validateStickerImage(image) {
  const prefix = 'data:image/webp;base64,';
  if (typeof image !== 'string' || !image.startsWith(prefix) || image.length > prefix.length + 136536) fail(400, 'Each sticker must be a WebP image no larger than 100 KiB.');
  const encoded = image.slice(prefix.length);
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) fail(400, 'Invalid WebP encoding.');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length > 102400 || bytes.length < 26 || bytes.toString('ascii', 0, 4) !== 'RIFF' ||
    bytes.toString('ascii', 8, 12) !== 'WEBP' || bytes.readUInt32LE(4) + 8 !== bytes.length) fail(400, 'Invalid WebP image.');
  let canvas;
  let frame;
  for (let offset = 12; offset < bytes.length;) {
    if (offset + 8 > bytes.length) fail(400, 'Truncated WebP image.');
    const tag = bytes.toString('ascii', offset, offset + 4);
    const length = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + length;
    if (end + (length % 2) > bytes.length) fail(400, 'Truncated WebP image.');
    if (tag === 'ANIM' || tag === 'ANMF') fail(400, 'Only static rendered stickers are supported.');
    if (tag === 'VP8X') {
      if (canvas || offset !== 12 || length !== 10 || (bytes[start] & 2)) fail(400, 'Invalid or animated WebP canvas.');
      canvas = [bytes.readUIntLE(start + 4, 3) + 1, bytes.readUIntLE(start + 7, 3) + 1];
    } else if (tag === 'VP8L') {
      if (frame || length < 6 || bytes[start] !== 0x2f) fail(400, 'Invalid WebP lossless frame.');
      const bits = bytes.readUInt32LE(start + 1);
      if ((bits >>> 29) !== 0) fail(400, 'Unsupported WebP version.');
      frame = [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
    } else if (tag === 'VP8 ') {
      if (frame || length < 11 || (bytes[start] & 1) || bytes.toString('hex', start + 3, start + 6) !== '9d012a') fail(400, 'Invalid WebP frame.');
      frame = [bytes.readUInt16LE(start + 6) & 0x3fff, bytes.readUInt16LE(start + 8) & 0x3fff];
    } else if (!['ALPH', 'ICCP'].includes(tag)) {
      // EXIF/XMP/unknown payloads can contain private authoring metadata.
      fail(400, 'Strip image metadata before sharing this finished sticker.');
    }
    offset = end + (length % 2);
  }
  if (!frame || frame.some(size => size !== 512) || (canvas && canvas.some(size => size !== 512))) fail(400, 'Stickers must be exactly 512 × 512 pixels.');
  return bytes;
}

export function createDistributionService({ store, publicBaseURL, telegram, webhookSecret, now = Date.now }) {
  const db = store.db;
  const base = new URL(publicBaseURL);
  if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== '/' ||
    (base.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))) {
    throw new Error('Public base URL must be an HTTPS origin (HTTP localhost is allowed for development).');
  }
  const origin = base.origin;
  db.exec(`
    CREATE TABLE IF NOT EXISTS beta_distribution_packs (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, creator_label TEXT NOT NULL, client_id TEXT,
      name TEXT NOT NULL, publisher TEXT NOT NULL, stickers TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1, published INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS beta_distribution_owner ON beta_distribution_packs(owner_id);
    CREATE TABLE IF NOT EXISTS beta_distribution_telegram_bindings (
      owner_id TEXT PRIMARY KEY, telegram_user_id INTEGER NOT NULL UNIQUE, linked_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS beta_distribution_telegram_nonces (
      nonce_hash TEXT PRIMARY KEY, owner_id TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS beta_distribution_telegram_exports (
      pack_id TEXT NOT NULL, revision INTEGER NOT NULL, telegram_user_id INTEGER NOT NULL,
      name TEXT NOT NULL, status TEXT NOT NULL, url TEXT, updated_at INTEGER NOT NULL,
      PRIMARY KEY(pack_id, revision)
    );
  `);
  if (!db.prepare('PRAGMA table_info(beta_distribution_packs)').all().some(column => column.name === 'client_id')) {
    db.exec('ALTER TABLE beta_distribution_packs ADD COLUMN client_id TEXT');
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS beta_distribution_client_id ON beta_distribution_packs(owner_id,client_id) WHERE client_id IS NOT NULL');
  const authenticate = owner => {
    if (!owner || typeof owner.id !== 'string' || !owner.id) fail(401, 'Sign in to manage collections.');
    return owner.id;
  };
  const packRow = (id, owner) => {
    const row = db.prepare('SELECT * FROM beta_distribution_packs WHERE id = ?').get(typeof id === 'string' ? id : '');
    if (!row || (owner ? row.owner_id !== authenticate(owner) : !row.published)) fail(404, 'Collection not found.');
    return row;
  };
  const ownerRow = (owner, id) => { authenticate(owner); return packRow(id, owner); };
  const expectRevision = (row, expectedRevision) => {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision <= 0) fail(400, 'A positive collection revision is required.');
    if (row.revision !== expectedRevision) fail(409, 'This collection changed. Review the latest version before sharing it.');
  };
  const exportRow = row => db.prepare('SELECT * FROM beta_distribution_telegram_exports WHERE pack_id = ? AND revision = ?').get(row.id, row.revision);
  const snapshot = (row, includeImages) => {
    const exported = exportRow(row);
    return {
      id: row.id, name: row.name, publisher: row.publisher, creator: { label: row.creator_label },
      count: JSON.parse(row.stickers).length, revision: row.revision, published: Boolean(row.published),
      createdAt: row.created_at, updatedAt: row.updated_at,
      publicURL: row.published ? `${origin}/p/${row.id}` : null,
      telegramURL: exported?.status === 'verified' ? exported.url : null,
      telegramStatus: exported?.status ?? 'not_created',
      stickers: JSON.parse(row.stickers).map((sticker, index) => includeImages ? sticker : { emoji: sticker.emoji, imageURL: `${origin}/public/packs/${row.id}/images/${index}` }),
    };
  };
  const manifest = row => ({
    format: 'bias-studio-finished-pack', version: 1,
    id: row.id, name: row.name, publisher: row.publisher, creator: { label: row.creator_label },
    stickers: JSON.parse(row.stickers),
  });
  const enabled = () => {
    if (!telegram || typeof webhookSecret !== 'string' || webhookSecret.length < 24) fail(503, 'Telegram is not configured for this beta.');
  };
  const linked = owner => db.prepare('SELECT * FROM beta_distribution_telegram_bindings WHERE owner_id = ?').get(authenticate(owner));
  const service = {
    save(owner, input) {
      const ownerId = authenticate(owner);
      own(input, ['id', 'clientId', 'name', 'publisher', 'stickers']);
      const clientId = input.clientId === undefined ? null : cleanText(input.clientId, 128, 'Local collection identity');
      if (clientId && !/^[a-zA-Z0-9_-]+$/.test(clientId)) fail(400, 'Invalid local collection identity.');
      const mapped = clientId ? db.prepare('SELECT * FROM beta_distribution_packs WHERE owner_id=? AND client_id=?').get(ownerId, clientId) : null;
      const previous = input.id === undefined ? mapped : packRow(input.id, owner);
      if ((mapped && mapped.id !== previous?.id) || (clientId && previous?.client_id && previous.client_id !== clientId)) fail(409, 'This local collection is already associated with a different saved collection.');
      const name = cleanText(input.name, 64, 'Collection name');
      const publisher = cleanText(input.publisher, 64, 'Creator credit');
      if (!Array.isArray(input.stickers) || input.stickers.length < 3 || input.stickers.length > 30) fail(400, 'A finished pack needs 3–30 stickers.');
      const stickers = input.stickers.map(sticker => {
        own(sticker, ['image', 'emoji']);
        validateStickerImage(sticker.image);
        const emoji = sticker.emoji === undefined ? '💜' : cleanText(sticker.emoji, 16, 'Reaction emoji');
        if (Array.from(new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(emoji)).length !== 1 ||
          !/\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3/u.test(emoji)) fail(400, 'Choose one emoji for each sticker.');
        return { image: sticker.image, emoji };
      });
      const serialized = JSON.stringify(stickers);
      if (previous && clientId && !previous.client_id) {
        db.prepare('UPDATE beta_distribution_packs SET client_id=? WHERE id=? AND owner_id=?').run(clientId, previous.id, ownerId);
      }
      // A retry of the exact same save must not hide a published pack or lose its export identity.
      if (previous && previous.name === name && previous.publisher === publisher && previous.stickers === serialized) return snapshot(previous, true);
      const usage = db.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(length(stickers)),0) AS bytes FROM beta_distribution_packs WHERE owner_id=?').get(ownerId);
      if ((!previous && usage.count >= 50) || usage.bytes - (previous?.stickers.length ?? 0) + serialized.length > 50 * 1024 * 1024) {
        fail(409, 'This beta allows 50 saved collections and 50 MiB of rendered pack data per creator. Update an existing collection or contact the beta administrator.');
      }
      const creatorLabel = cleanText(owner.label, 64, 'Creator name');
      const id = previous?.id ?? randomBytes(18).toString('hex');
      const time = now();
      db.prepare(`INSERT INTO beta_distribution_packs(id,owner_id,creator_label,client_id,name,publisher,stickers,revision,published,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,1,0,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,publisher=excluded.publisher,
        stickers=excluded.stickers,creator_label=excluded.creator_label,revision=beta_distribution_packs.revision+1,published=0,updated_at=excluded.updated_at`)
        .run(id, ownerId, creatorLabel, clientId, name, publisher, serialized, time, time);
      return snapshot(packRow(id, owner), true);
    },
    ownerGet: (owner, id) => snapshot(ownerRow(owner, id), true),
    list(owner) { return db.prepare('SELECT * FROM beta_distribution_packs WHERE owner_id = ? ORDER BY updated_at DESC').all(authenticate(owner)).map(row => snapshot(row, false)); },
    publish(owner, id, expectedRevision) {
      const row = ownerRow(owner, id);
      expectRevision(row, expectedRevision);
      const result = db.prepare('UPDATE beta_distribution_packs SET published=1,updated_at=? WHERE id=? AND owner_id=? AND revision=?')
        .run(now(), id, owner.id, expectedRevision);
      if (!result.changes) fail(409, 'This collection changed. Review the latest version before sharing it.');
      return service.ownerGet(owner, id);
    },
    unpublish(owner, id) {
      ownerRow(owner, id);
      db.prepare('UPDATE beta_distribution_packs SET published=0,updated_at=? WHERE id=?').run(now(), id);
      return service.ownerGet(owner, id);
    },
    publicGet: id => snapshot(packRow(id), false),
    publicImage(id, index) {
      const row = packRow(id);
      const stickers = JSON.parse(row.stickers);
      if (!Number.isInteger(index) || index < 0 || index >= stickers.length) fail(404, 'Sticker not found.');
      return Buffer.from(stickers[index].image.split(',')[1], 'base64');
    },
    manifest: (owner, id) => manifest(ownerRow(owner, id)),
    publicManifest: id => manifest(packRow(id)),
    startTelegramLink(owner) {
      enabled();
      const ownerId = authenticate(owner);
      if (linked(owner)) fail(409, 'Unlink your current Telegram account before linking another.');
      const nonce = randomBytes(32).toString('base64url');
      const expiresAt = now() + 10 * 60_000;
      db.prepare('INSERT INTO beta_distribution_telegram_nonces(nonce_hash,owner_id,created_at,expires_at) VALUES(?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET nonce_hash=excluded.nonce_hash,created_at=excluded.created_at,expires_at=excluded.expires_at').run(hash(nonce), ownerId, now(), expiresAt);
      return { url: `https://t.me/${telegram.username}?start=${nonce}`, expiresAt };
    },
    telegramStatus(owner) {
      const binding = linked(owner);
      return { available: Boolean(telegram && webhookSecret?.length >= 24), linked: Boolean(binding), linkedAt: binding?.linked_at ?? null };
    },
    unlinkTelegram(owner) {
      const ownerId = authenticate(owner);
      db.prepare('DELETE FROM beta_distribution_telegram_bindings WHERE owner_id=?').run(ownerId);
      db.prepare('DELETE FROM beta_distribution_telegram_nonces WHERE owner_id=?').run(ownerId);
      return service.telegramStatus(owner);
    },
    acceptTelegramUpdate(update, suppliedSecret) {
      enabled();
      if (typeof suppliedSecret !== 'string' || !timingSafeEqual(Buffer.from(hash(suppliedSecret)), Buffer.from(hash(webhookSecret)))) fail(401, 'Invalid webhook authentication.');
      const message = update?.message;
      const match = typeof message?.text === 'string' && message.text.match(/^\/start(?:@[a-zA-Z0-9_]+)? ([a-zA-Z0-9_-]{43})$/);
      if (!match) return { accepted: false };
      if (message.chat?.type !== 'private' || !Number.isSafeInteger(message.from?.id) || message.from.id <= 0 || message.from.is_bot || message.chat.id !== message.from.id) fail(400, 'Link Telegram from your private chat with the bot.');
      db.exec('BEGIN IMMEDIATE');
      try {
        const nonce = db.prepare('SELECT * FROM beta_distribution_telegram_nonces WHERE nonce_hash=?').get(hash(match[1]));
        if (!nonce || nonce.expires_at <= now()) fail(409, 'This Telegram link has expired or was already used. Request a new link in Bias Studio.');
        const other = db.prepare('SELECT owner_id FROM beta_distribution_telegram_bindings WHERE telegram_user_id=? OR owner_id=?').get(message.from.id, nonce.owner_id);
        if (other) fail(409, 'This creator or Telegram account is already linked. Unlink it first.');
        db.prepare('INSERT INTO beta_distribution_telegram_bindings(owner_id,telegram_user_id,linked_at) VALUES(?,?,?)').run(nonce.owner_id, message.from.id, now());
        db.prepare('DELETE FROM beta_distribution_telegram_nonces WHERE nonce_hash=?').run(hash(match[1]));
        db.exec('COMMIT');
        return { accepted: true };
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    async createTelegramSet(owner, id, expectedRevision) {
      enabled();
      const row = ownerRow(owner, id);
      expectRevision(row, expectedRevision);
      const binding = linked(owner);
      if (!binding) fail(409, 'Link your Telegram account first.');
      const name = telegram.setName(row.id, row.revision);
      const previous = exportRow(row);
      if (previous && previous.telegram_user_id !== binding.telegram_user_id) fail(409, 'This version belongs to the previously linked Telegram account. Save a new pack version to export with this account.');
      if (previous?.status === 'verified') return { status: 'verified', name: previous.name, url: previous.url };
      const claimed = db.prepare('INSERT OR IGNORE INTO beta_distribution_telegram_exports(pack_id,revision,telegram_user_id,name,status,updated_at) VALUES(?,?,?,?,?,?)')
        .run(id, row.revision, binding.telegram_user_id, name, 'pending', now());
      const reconcileOnly = !claimed.changes && previous?.status !== 'failed';
      if (!claimed.changes && previous?.status === 'failed') {
        const retry = db.prepare("UPDATE beta_distribution_telegram_exports SET status='pending',updated_at=? WHERE pack_id=? AND revision=? AND status='failed'").run(now(), id, row.revision);
        if (!retry.changes) fail(409, 'Telegram export is already running. Check again shortly.');
      }
      try {
        const result = await telegram.createSet({ userId: binding.telegram_user_id, name, title: row.name, stickers: JSON.parse(row.stickers), reconcileOnly });
        if (result?.name !== name || result.url !== `https://t.me/addstickers/${encodeURIComponent(name)}`) fail(502, 'Telegram returned an unexpected installation link.');
        db.prepare("UPDATE beta_distribution_telegram_exports SET status='verified',url=?,updated_at=? WHERE pack_id=? AND revision=?").run(result.url, now(), id, row.revision);
        return { status: 'verified', name, url: result.url };
      } catch (error) {
        // Never downgrade a successful concurrent reconciliation.
        db.prepare("UPDATE beta_distribution_telegram_exports SET status=?,updated_at=? WHERE pack_id=? AND revision=? AND status!='verified'")
          .run(error.uncertain || reconcileOnly ? 'uncertain' : 'failed', now(), id, row.revision);
        throw error;
      }
    },
  };
  return service;
}

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

/** The route must call publicGet immediately before rendering; serve HTML and images with no-store. */
export function renderPackPage(pack, { downloadURL, appURL } = {}) {
  if (pack.publicURL && /^[a-zA-Z0-9-]+$/.test(pack.id)) {
    try { downloadURL ??= `${new URL(pack.publicURL).origin}/public/packs/${pack.id}/download`; } catch { /* Omit invalid links. */ }
    appURL ??= `biasstudio://receive/${pack.id}`;
  }
  const safeURL = (value, protocols = ['https:', 'http:']) => {
    try { const parsed = new URL(value); return protocols.includes(parsed.protocol) && !parsed.username && !parsed.password ? escape(parsed.href) : null; }
    catch { return null; }
  };
  const download = safeURL(downloadURL);
  const app = safeURL(appURL, ['biasstudio:']);
  const telegram = typeof pack.telegramURL === 'string' && /^https:\/\/t\.me\/addstickers\/[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(pack.telegramURL) ? escape(pack.telegramURL) : null;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escape(pack.name)} · Bias Studio</title><style>
  :root{color-scheme:dark;font-family:system-ui,sans-serif;background:#17131e;color:#fff6ff}*{box-sizing:border-box}body{margin:0;padding:28px 20px 48px}main{max-width:640px;margin:auto}.brand{color:#d5acff;font-weight:800;letter-spacing:.1em;font-size:12px}h1{font-size:clamp(30px,8vw,48px);line-height:1.08;overflow-wrap:anywhere}p{line-height:1.6;color:#d0c5d8}.credit{color:#f4d5ff}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:28px 0}.tile{aspect-ratio:1;border-radius:20px;background:#292132;display:grid;place-items:center}.tile img{width:100%;height:100%;object-fit:contain}a.button{display:block;background:#d0a5ff;color:#21112f;padding:17px;border-radius:16px;margin:12px 0;text-decoration:none;font-weight:750;text-align:center;min-height:52px}a.secondary{background:#33263e;color:#f5e9ff}small{display:block;color:#c8bccc;line-height:1.6}a:focus-visible{outline:3px solid white;outline-offset:4px}
  </style></head><body><main><div class="brand">BIAS STUDIO · REACTION COLLECTION</div><h1>${escape(pack.name)}</h1><p class="credit">Created by ${escape(pack.publisher)} · ${escape(pack.creator.label)}</p><p>${escape(pack.count)} finished stickers. Favorite moments, ready for your next reaction.</p><div class="grid">${pack.stickers.map((sticker, index) => `<div class="tile"><img src="${safeURL(sticker.imageURL) || ''}" alt="Reaction sticker ${index + 1}" width="160" height="160" loading="lazy"></div>`).join('')}</div>
  ${telegram ? `<a class="button" href="${telegram}" rel="noopener noreferrer">Open sticker pack in Telegram</a><small>Telegram opens its pack preview. Choose Add Stickers there.</small>` : ''}
  ${app ? `<a class="button secondary" href="${app}">Open in Bias Studio for WhatsApp</a><small>Import the collection in Bias Studio, then choose Add to WhatsApp and confirm in WhatsApp.</small>` : ''}
  ${download ? `<a class="button secondary" href="${download}">Download finished sticker pack</a><small>This download contains rendered stickers and creator credit. Downloading does not install stickers in a chat app.</small>` : ''}
  <p><small>Original photos, editable designs and generation prompts are not included. Shared and downloaded copies may remain available after the creator unpublishes this page.</small></p></main></body></html>`;
}

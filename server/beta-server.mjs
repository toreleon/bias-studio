import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { zipSync, strToU8 } from 'fflate';
import { createBetaStore } from './beta-store.mjs';
import { createGenerationService } from './beta-generation.mjs';
import { createDistributionService, renderPackPage, DistributionError } from './beta-distribution.mjs';
import { createTelegramAdapter, TelegramError } from './telegram.mjs';
import { openAIImage, ServiceError } from './generation.mjs';

async function jsonBody(req) {
  if (!(req.headers['content-type'] || '').startsWith('application/json')) throw new ServiceError(415, 'Send JSON.');
  const chunks = []; let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 8 * 1024 * 1024) throw new ServiceError(413, 'Request is too large.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); }
  catch { throw new ServiceError(400, 'Invalid JSON.'); }
}
export function finishedZip(manifest) {
  const stickers = manifest.stickers.map((item, i) => ({file: `stickers/${String(i + 1).padStart(2, '0')}.webp`, emoji: item.emoji}));
  const files = { 'collection.json': strToU8(JSON.stringify({format:'bias-studio-finished',version:1,id:manifest.id,name:manifest.name,publisher:manifest.publisher,stickers})),
    'READ-ME.txt': strToU8('Finished stickers only. Creator credit is in collection.json. Import this ZIP in Bias Studio to preview and use its supported native WhatsApp handoff. A download does not install a pack. Original photos, editing sources and generation prompts are not included.') };
  for (const [i, item] of manifest.stickers.entries()) files[stickers[i].file] = Buffer.from(item.image.split(',')[1], 'base64');
  return zipSync(files, {level: 0});
}

export function createBetaServer({ store, generation, distribution, origin = 'http://localhost:8081', telegramEnabled = false, generationEnabled = false, publicPages = true, now = Date.now } = {}) {
  const buckets = new Map();
  function sessionLimit(req) {
    // No forwarded IP is trusted. A reverse proxy must also rate-limit auth routes.
    const ip = req.socket.remoteAddress || 'unknown'; const minute = Math.floor(now() / 60000);
    if (buckets.size > 10000) buckets.clear();
    const entry = buckets.get(ip); const count = entry?.minute === minute ? entry.count + 1 : 1;
    buckets.set(ip, {minute, count});
    if (count > 20) throw new ServiceError(429, 'Too many sign-in attempts. Try in a minute.');
  }
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
    const send = (status, value, type = 'application/json; charset=utf-8') => {
      res.writeHead(status, {'Content-Type': type});
      res.end(type.startsWith('application/json') ? JSON.stringify(value) : value);
    };
    try {
      if (req.headers.origin && req.headers.origin !== origin) throw new ServiceError(403, 'Origin not allowed.');
      if (req.headers.origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.writeHead(204); res.end(); return;
      }
      const path = new URL(req.url, 'http://localhost').pathname;
      if (path === '/health' && req.method === 'GET') return send(200, {status: 'ready'});
      if (path === '/v1/config' && req.method === 'GET') return send(200, {telegram: telegramEnabled, generation: generationEnabled, publicPages});
      if (path === '/v1/session' && req.method === 'POST') {
        sessionLimit(req); const body = await jsonBody(req);
        return send(200, store.exchangeInvite(body?.code));
      }
      if (path === '/v1/telegram/webhook' && req.method === 'POST') {
        if (!telegramEnabled) throw new ServiceError(404, 'Not found.');
        const update = await jsonBody(req);
        try { distribution.acceptTelegramUpdate(update, req.headers['x-telegram-bot-api-secret-token']); }
        catch (error) {
          // A consumed/expired nonce must not cause repeated Telegram deliveries.
          // Authentication failures still fail closed; no rebinding occurs.
          if (!(error instanceof DistributionError) || error.status !== 409) throw error;
        }
        return send(200, {ok: true});
      }
      const page = /^\/p\/([a-zA-Z0-9-]+)$/.exec(path);
      const publicPack = /^\/public\/packs\/([a-zA-Z0-9-]+)(?:\/(download|images\/(\d+)))?$/.exec(path);
      if ((page || publicPack) && req.method === 'GET') {
        if (!publicPages) throw new ServiceError(404, 'Not found.');
        const id = (page || publicPack)[1];
        if (page) return send(200, renderPackPage(distribution.publicGet(id)), 'text/html; charset=utf-8');
        if (publicPack[2] === 'download') {
          const bytes = finishedZip(distribution.publicManifest(id));
          res.setHeader('Content-Disposition', `attachment; filename="bias-studio-${id}.zip"`);
          return send(200, bytes, 'application/zip');
        }
        if (publicPack[3] !== undefined) return send(200, distribution.publicImage(id, Number(publicPack[3])), 'image/webp');
        return send(200, distribution.publicGet(id));
      }
      const token = /^Bearer (\S+)$/.exec(req.headers.authorization || '')?.[1];
      const owner = store.authenticate(token);
      if (path === '/v1/session' && req.method === 'DELETE') { store.revokeSession(token); return send(200, {ok:true}); }
      if (path === '/v1/usage' && req.method === 'GET') return send(200, generation.usage(owner));
      if (path === '/v1/jobs' && req.method === 'POST') {
        return send(202, generation.submit(owner, await jsonBody(req), {allowNew:generationEnabled}));
      }
      const job = /^\/v1\/jobs\/([a-zA-Z0-9-]+)(?:\/(cancel|kept))?$/.exec(path);
      if (job) {
        if (!job[2] && req.method === 'GET') return send(200, generation.get(owner, job[1]));
        if (job[2] === 'cancel' && req.method === 'POST') return send(200, generation.cancel(owner, job[1]));
        if (job[2] === 'kept' && req.method === 'POST') return send(200, generation.markKept(owner, job[1], (await jsonBody(req))?.kept));
      }
      if (path === '/v1/packs') {
        if (req.method === 'POST') return send(200, distribution.save(owner, await jsonBody(req)));
        if (req.method === 'GET') return send(200, distribution.list(owner));
      }
      const pack = /^\/v1\/packs\/([a-zA-Z0-9-]+)(?:\/(publish|unpublish|telegram))?$/.exec(path);
      if (pack) {
        if (!pack[2] && req.method === 'GET') return send(200, distribution.ownerGet(owner, pack[1]));
        if (req.method === 'POST') {
          if (pack[2] === 'publish') { if (!publicPages) throw new ServiceError(503, 'Publishing is disabled.'); return send(200, distribution.publish(owner, pack[1], (await jsonBody(req))?.revision)); }
          if (pack[2] === 'unpublish') return send(200, distribution.unpublish(owner, pack[1]));
          if (pack[2] === 'telegram') return send(200, await distribution.createTelegramSet(owner, pack[1], (await jsonBody(req))?.revision));
        }
      }
      if (path === '/v1/telegram/link') {
        if (req.method === 'GET') return send(200, distribution.telegramStatus(owner));
        if (req.method === 'POST') return send(200, distribution.startTelegramLink(owner));
        if (req.method === 'DELETE') return send(200, distribution.unlinkTelegram(owner));
      }
      throw new ServiceError(404, 'Not found.');
    } catch (error) {
      // Never echo unknown exceptions, upstream bodies, credentials or request content.
      const known = error instanceof ServiceError || error instanceof DistributionError || error instanceof TelegramError;
      if (!res.destroyed) send(known ? error.status : 503, {error: known ? error.message : 'The service is unavailable. Saved work is safe.'});
    }
  });
  server.requestTimeout = 20000; server.headersTimeout = 10000; server.keepAliveTimeout = 5000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.umask(0o077);
  const store = createBetaStore({filename:process.env.BETA_DB || './server/data/beta.sqlite',
    defaultQuota:Number(process.env.BETA_CREATOR_DAILY_LIMIT || 20), maxDailyAttempts:Number(process.env.BETA_DAILY_LIMIT || 100),
    reservationMicros:Number(process.env.BETA_RESERVATION_MICROS || 50000), maxDailyReservedMicros:Number(process.env.BETA_DAILY_BUDGET_MICROS || 5000000)});
  const apiKey = process.env.OPENAI_API_KEY;
  const generation = createGenerationService({store,generate:(input,{signal}) => openAIImage(input,{apiKey,signal,model:process.env.GENERATION_MODEL || 'gpt-image-2.6-sunburst'})});
  const telegram = process.env.TELEGRAM_BOT_TOKEN ? createTelegramAdapter({token:process.env.TELEGRAM_BOT_TOKEN,username:process.env.TELEGRAM_BOT_USERNAME}) : undefined;
  const distribution = createDistributionService({store,telegram,publicBaseURL:process.env.BETA_PUBLIC_URL || 'http://localhost:8788',webhookSecret:process.env.TELEGRAM_WEBHOOK_SECRET});
  const server = createBetaServer({store,generation,distribution,generationEnabled:!!apiKey,telegramEnabled:!!telegram && (process.env.TELEGRAM_WEBHOOK_SECRET?.length || 0) >= 24,origin:process.env.BETA_WEB_ORIGIN || 'http://localhost:8081'});
  server.listen(Number(process.env.BETA_PORT || 8788), process.env.BETA_HOST || '127.0.0.1', () => console.log('Bias Studio beta service ready. Request content is not logged.'));
  const stop = () => { server.close(async () => { await generation.close(); store.close(); }); };
  process.once('SIGTERM',stop); process.once('SIGINT',stop);
}

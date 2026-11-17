import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

export class TelegramError extends Error {
  constructor(message, { status = 502, uncertain = false, notFound = false } = {}) {
    super(message);
    this.status = status;
    this.uncertain = uncertain;
    this.notFound = notFound;
  }
}

/** Names are stable across retries and stay below Telegram's 64-character limit. */
export function telegramSetName(packId, revision, username) {
  if (!/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(username) || username.includes('__')) {
    throw new TelegramError('Configure a valid Telegram bot username.', { status: 503 });
  }
  const hash = createHash('sha256').update(`${packId}:${revision}`).digest('hex').slice(0, 23);
  return `bias_${hash}_by_${username}`;
}

/** Server-only adapter. No messages are sent; only explicitly requested sets are created. */
export function createTelegramAdapter({ token, username, request = fetch, timeoutMs = 30_000 }) {
  telegramSetName('configuration', 1, username);
  if (typeof token !== 'string' || !token.trim()) {
    throw new TelegramError('Configure a Telegram bot token.', { status: 503 });
  }
  let identity;
  async function call(method, body) {
    try {
      const multipart = body instanceof FormData;
      const response = await request(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: multipart ? undefined : { 'content-type': 'application/json' },
        body: multipart ? body : JSON.stringify(body ?? {}),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const result = await response.json();
      if (!response.ok || result?.ok !== true) {
        const description = typeof result?.description === 'string' ? result.description : '';
        const notFound = result?.error_code === 400 && /STICKERSET_INVALID|stickerset not found|sticker set not found/i.test(description);
        throw new TelegramError(notFound ? 'Telegram has not found this sticker set.' : 'Telegram rejected the request. Check the bot configuration and linked account, then retry.', {
          notFound, uncertain: response.status >= 500 || result?.error_code >= 500,
        });
      }
      return result.result;
    } catch (error) {
      if (error instanceof TelegramError) throw error;
      // Fetch errors can contain the URL and bot token. Never propagate their text.
      throw new TelegramError('Telegram could not be reached. Check the existing set before retrying.', { uncertain: true });
    }
  }
  async function verifyIdentity() {
    if (!identity) {
      const me = await call('getMe');
      if (me?.is_bot !== true || me?.username?.toLowerCase() !== username.toLowerCase()) {
        throw new TelegramError('Telegram token and bot username do not match.', { status: 503 });
      }
      identity = me;
    }
  }
  async function getSet(name, expectedCount) {
    const set = await call('getStickerSet', { name });
    if (set?.name?.toLowerCase() !== name.toLowerCase() || set.sticker_type !== 'regular' ||
      !Array.isArray(set.stickers) || set.stickers.length !== expectedCount ||
      set.stickers.some(sticker => sticker.is_animated !== false || sticker.is_video !== false ||
        sticker.width !== 512 || sticker.height !== 512)) {
      throw new TelegramError('Telegram returned a set that does not match this pack. Keep the pack and contact support.', { uncertain: true });
    }
    return { name: set.name, url: `https://t.me/addstickers/${encodeURIComponent(set.name)}`, count: set.stickers.length };
  }
  return {
    username,
    setName: (packId, revision) => telegramSetName(packId, revision, username),
    async createSet({ userId, name, title, stickers, reconcileOnly = false }) {
      if (!Number.isSafeInteger(userId) || userId <= 0 || !Array.isArray(stickers) || stickers.length < 3 || stickers.length > 30 ||
        typeof name !== 'string' || name.length > 64 || !/^[a-zA-Z][a-zA-Z0-9_]+$/.test(name) || name.includes('__') ||
        !name.toLowerCase().endsWith(`_by_${username.toLowerCase()}`)) {
        throw new TelegramError('Invalid Telegram sticker-set request.', { status: 400 });
      }
      try {
        await verifyIdentity();
        try { return await getSet(name, stickers.length); }
        catch (error) { if (!error.notFound) throw error; }
      } catch (error) {
        // No mutation has been attempted in this call. A fresh request can safely retry.
        error.uncertain = reconcileOnly;
        throw error;
      }
      if (reconcileOnly) {
        throw new TelegramError('The earlier Telegram request is still unconfirmed. Check again later; no duplicate set was created.', { status: 409, uncertain: true });
      }
      const form = new FormData();
      form.set('user_id', String(userId));
      form.set('name', name);
      form.set('title', Array.from(title).slice(0, 64).join(''));
      form.set('sticker_type', 'regular');
      form.set('stickers', JSON.stringify(stickers.map((sticker, index) => {
        const bytes = Buffer.from(sticker.image.slice('data:image/webp;base64,'.length), 'base64');
        form.set(`sticker${index}`, new Blob([bytes], { type: 'image/webp' }), `sticker${index}.webp`);
        return { sticker: `attach://sticker${index}`, format: 'static', emoji_list: [sticker.emoji || '💜'] };
      })));
      try {
        const created = await call('createNewStickerSet', form);
        if (created !== true) throw new TelegramError('Telegram did not confirm the sticker set.', { uncertain: true });
      } catch (error) {
        // The request may have completed remotely even when its response was lost.
        try { return await getSet(name, stickers.length); }
        catch (verification) {
          if (!verification.notFound) throw new TelegramError('Telegram creation needs verification. Check again without creating another set.', { uncertain: true });
          throw error;
        }
      }
      try { return await getSet(name, stickers.length); }
      catch { throw new TelegramError('Telegram accepted the pack but verification is pending. Check again later.', { uncertain: true }); }
    },
  };
}

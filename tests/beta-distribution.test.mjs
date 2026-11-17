import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDistributionService, renderPackPage, validateStickerImage } from '../server/beta-distribution.mjs';
import { createTelegramAdapter, telegramSetName } from '../server/telegram.mjs';

// Actual Pillow-encoded 512×512 static WebP, not a fabricated MIME/header fixture.
const image = 'data:image/webp;base64,UklGRi4AAABXRUJQVlA4TCIAAAAv/8F/AAdQpAqWu/8BgUCyv/cMRfQ/4z//+c9//vOf//wf';
const secret = 'test-only-webhook-secret-of-sufficient-length';
const owner = { id: 'creator-a', label: 'Mina' };
const other = { id: 'creator-b', label: 'Joon' };
const input = () => ({ name: 'Encore reactions', publisher: '@minas-corner', stickers: Array.from({ length: 3 }, () => ({ image, emoji: '💜' })) });
const status = expected => error => error.status === expected;
const bot = (overrides = {}) => ({
  username: 'bias_test_bot',
  setName: (id, revision) => telegramSetName(id, revision, 'bias_test_bot'),
  async createSet({ name }) { return { name, url: `https://t.me/addstickers/${name}` }; },
  ...overrides,
});
function setup(t, options = {}) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  const service = createDistributionService({ store: { db }, publicBaseURL: 'https://bias.example', telegram: bot(), webhookSecret: secret, ...options });
  return { service, db };
}
function link(service, creator = owner, userId = 42) {
  const start = service.startTelegramLink(creator);
  const nonce = new URL(start.url).searchParams.get('start');
  const update = { update_id: 1, message: { text: `/start ${nonce}`, from: { id: userId, is_bot: false }, chat: { type: 'private', id: userId } } };
  service.acceptTelegramUpdate(update, secret);
  return update;
}

test('finished snapshots are private, owner-scoped, and public bytes disappear on unpublish', t => {
  const { service } = setup(t);
  const saved = service.save(owner, input());
  assert.match(saved.id, /^[a-f0-9]{36}$/);
  assert.equal(saved.published, false);
  assert.equal(saved.publicURL, null);
  assert.throws(() => service.publicGet(saved.id), status(404));
  assert.throws(() => service.publicImage(saved.id, 0), status(404));
  assert.throws(() => service.publicManifest(saved.id), status(404));
  assert.throws(() => service.ownerGet(other, saved.id), status(404));
  assert.throws(() => service.publish(other, saved.id), status(404));
  assert.throws(() => service.save(other, { ...input(), id: saved.id }), status(404));
  assert.deepEqual(service.list(other), []);
  service.publish(owner, saved.id, saved.revision);
  assert.throws(() => service.unpublish(undefined, saved.id), status(401));
  assert.throws(() => service.publish(null, saved.id), status(401));
  assert.throws(() => service.ownerGet(undefined, saved.id), status(401));
  const publicPack = service.publicGet(saved.id);
  assert.equal(publicPack.stickers[0].imageURL, `https://bias.example/public/packs/${saved.id}/images/0`);
  assert.equal(publicPack.stickers[0].image, undefined);
  assert.deepEqual(publicPack.creator, { label: 'Mina' });
  assert.equal(JSON.stringify(publicPack).includes(owner.id), false);
  assert.deepEqual(service.publicImage(saved.id, 0), validateStickerImage(image));
  assert.throws(() => service.publicImage(saved.id, -1), status(404));
  const manifest = service.publicManifest(saved.id);
  assert.deepEqual(Object.keys(manifest).sort(), ['creator', 'format', 'id', 'name', 'publisher', 'stickers', 'version']);
  assert.deepEqual(Object.keys(manifest.stickers[0]).sort(), ['emoji', 'image']);
  service.unpublish(owner, saved.id);
  assert.throws(() => service.publicGet(saved.id), status(404));
  assert.throws(() => service.publicImage(saved.id, 0), status(404));
  assert.throws(() => service.publicManifest(saved.id), status(404));
  assert.equal(service.ownerGet(owner, saved.id).name, saved.name);
});

test('identical save is idempotent; changed content becomes a new private revision', t => {
  const { service } = setup(t);
  const saved = service.save(owner, input());
  service.publish(owner, saved.id, saved.revision);
  const repeated = service.save(owner, { ...input(), id: saved.id });
  assert.equal(repeated.revision, 1);
  assert.equal(repeated.published, true);
  const edited = service.save(owner, { ...input(), id: saved.id, name: 'Tour reactions' });
  assert.equal(edited.revision, 2);
  assert.equal(edited.published, false);
  assert.throws(() => service.publicImage(saved.id, 0), status(404));
});

test('creator-scoped local identity recovers a lost new-save response across restart', t => {
  const { service, db } = setup(t);
  const saved = service.save(owner, { ...input(), clientId: 'local-collection-123' });
  service.publish(owner, saved.id, saved.revision);
  const restarted = createDistributionService({ store: { db }, publicBaseURL: 'https://bias.example' });
  const recovered = restarted.save(owner, { ...input(), clientId: 'local-collection-123' });
  assert.equal(recovered.id, saved.id);
  assert.equal(recovered.revision, 1);
  assert.equal(recovered.published, true);
  assert.equal(restarted.list(owner).length, 1);
  assert.notEqual(restarted.save(other, { ...input(), clientId: 'local-collection-123' }).id, saved.id);
  const changed = restarted.save(owner, { ...input(), clientId: 'local-collection-123', name: 'Reopened and edited' });
  assert.equal(changed.id, saved.id);
  assert.equal(changed.revision, 2);
  assert.equal(changed.published, false);
  assert.equal(JSON.stringify(restarted.manifest(owner, saved.id)).includes('local-collection-123'), false);
  const different = restarted.save(owner, input());
  assert.throws(() => restarted.save(owner, { ...input(), id: different.id, clientId: 'local-collection-123' }), status(409));
});

test('publication and Telegram creation require consent to the current revision', async t => {
  let creates = 0;
  const { service } = setup(t, { telegram: bot({ async createSet({ name }) { creates++; return { name, url: `https://t.me/addstickers/${name}` }; } }) });
  const saved = service.save(owner, input());
  link(service);
  for (const revision of [undefined, null, '1', 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => service.publish(owner, saved.id, revision), status(400));
    await assert.rejects(service.createTelegramSet(owner, saved.id, revision), status(400));
  }
  const latest = service.save(owner, { ...input(), id: saved.id, name: 'Changed after preview' });
  assert.throws(() => service.publish(owner, saved.id, saved.revision), status(409));
  await assert.rejects(service.createTelegramSet(owner, saved.id, saved.revision), status(409));
  assert.equal(creates, 0);
  assert.equal(service.ownerGet(owner, saved.id).published, false);
  assert.throws(() => service.publicGet(saved.id), status(404));
  assert.equal(service.publish(owner, saved.id, latest.revision).revision, latest.revision);
  assert.equal((await service.createTelegramSet(owner, saved.id, latest.revision)).status, 'verified');
  assert.equal(creates, 1);
});

test('rendered snapshots survive a database close/reopen', () => {
  const directory = mkdtempSync(join(tmpdir(), 'bias-distribution-'));
  let db;
  try {
    db = new DatabaseSync(join(directory, 'beta.sqlite'));
    let service = createDistributionService({ store: { db }, publicBaseURL: 'http://localhost:8788' });
    const saved = service.save(owner, input());
    service.publish(owner, saved.id, saved.revision);
    db.close();
    db = new DatabaseSync(join(directory, 'beta.sqlite'));
    service = createDistributionService({ store: { db }, publicBaseURL: 'http://localhost:8788' });
    assert.equal(service.ownerGet(owner, saved.id).stickers[0].image, image);
    assert.equal(service.publicGet(saved.id).published, true);
  } finally { db?.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('strict boundary rejects private sources, prompts, claimed metadata and invalid size/count', t => {
  const { service } = setup(t);
  for (const extra of [{ sources: [] }, { prompt: 'secret' }, { creator: owner }, { published: true }, { user_id: 42 }]) {
    assert.throws(() => service.save(owner, { ...input(), ...extra }), status(400));
  }
  for (const field of ['source', 'prompt', 'caption', 'width', 'design']) {
    const data = input(); data.stickers[0][field] = 'private';
    assert.throws(() => service.save(owner, data), status(400));
  }
  for (const count of [0, 2, 31]) assert.throws(() => service.save(owner, { ...input(), stickers: Array.from({ length: count }, () => ({ image })) }), status(400));
  for (const name of ['', 'a'.repeat(65), 'hidden\ncredit']) assert.throws(() => service.save(owner, { ...input(), name }), status(400));
  assert.throws(() => service.save(owner, { ...input(), stickers: input().stickers.map(sticker => ({ ...sticker, emoji: 'caption 💜' })) }), status(400));
  assert.throws(() => validateStickerImage(image.replace('image/webp', 'image/png')), status(400));
  assert.throws(() => validateStickerImage(`${image}garbage`), status(400));
  assert.throws(() => validateStickerImage(`data:image/webp;base64,${Buffer.alloc(102401).toString('base64')}`), status(400));
  const bytes = Buffer.from(image.split(',')[1], 'base64');
  const wrongSize = Buffer.from(bytes); wrongSize[21] = 0;
  assert.throws(() => validateStickerImage(`data:image/webp;base64,${wrongSize.toString('base64')}`), status(400));
  assert.throws(() => validateStickerImage(`data:image/webp;base64,${bytes.subarray(0, -2).toString('base64')}`), status(400));
  const metadata = Buffer.concat([bytes, Buffer.from('XMP \u0004\u0000\u0000\u0000test', 'binary')]);
  metadata.writeUInt32LE(metadata.length - 8, 4);
  assert.throws(() => validateStickerImage(`data:image/webp;base64,${metadata.toString('base64')}`), status(400));
});

test('per-creator saved collection limit bounds durable pack growth', t => {
  const { service } = setup(t);
  let first;
  for (let i = 0; i < 50; i++) { const saved = service.save(owner, input()); first ??= saved; }
  assert.throws(() => service.save(owner, input()), status(409));
  assert.equal(service.save(owner, { ...input(), id: first.id, name: 'Updated' }).name, 'Updated');
  assert.equal(service.save(other, input()).revision, 1);
});

test('public page escapes credit and names; only real destination links are offered', t => {
  const { service } = setup(t);
  const saved = service.save(owner, { ...input(), name: '<script>alert(1)</script>', publisher: '" onclick="x' });
  const html = renderPackPage(service.publish(owner, saved.id, saved.revision));
  assert.equal(html.includes('<script>'), false);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&quot; onclick=&quot;x/);
  assert.match(html, /Downloading does not install/);
  assert.match(html, /biasstudio:\/\/receive\//);
  assert.match(html, /public\/packs\/.*\/download/);
  assert.equal(html.includes('Open sticker pack in Telegram'), false);
  assert.equal(renderPackPage({ ...service.publicGet(saved.id), telegramURL: 'javascript:alert(1)' }).includes('javascript:'), false);
});

test('Telegram account binding requires webhook secret, private chat, unexpired one-use nonce', t => {
  let time = 1000;
  const { service } = setup(t, { now: () => time });
  const start = service.startTelegramLink(owner);
  const nonce = new URL(start.url).searchParams.get('start');
  const update = { message: { text: `/start ${nonce}`, from: { id: 42, is_bot: false }, chat: { type: 'private', id: 42 } } };
  assert.throws(() => service.acceptTelegramUpdate(update, 'forged-secret'), status(401));
  assert.throws(() => service.acceptTelegramUpdate({ message: { ...update.message, chat: { type: 'group', id: -1 } } }, secret), status(400));
  assert.throws(() => service.acceptTelegramUpdate({ message: { ...update.message, chat: { type: 'private', id: 99 } } }, secret), status(400));
  assert.equal(service.telegramStatus(owner).linked, false);
  assert.deepEqual(service.acceptTelegramUpdate(update, secret), { accepted: true });
  assert.equal(service.telegramStatus(owner).linked, true);
  assert.equal(service.telegramStatus(other).linked, false);
  assert.throws(() => service.acceptTelegramUpdate(update, secret), status(409));
  assert.throws(() => service.startTelegramLink(owner), status(409));
  assert.throws(() => link(service, other, 42), status(409));
  service.unlinkTelegram(owner);
  assert.equal(service.telegramStatus(owner).linked, false);
  const expired = service.startTelegramLink(owner);
  time = expired.expiresAt;
  update.message.text = `/start ${new URL(expired.url).searchParams.get('start')}`;
  assert.throws(() => service.acceptTelegramUpdate(update, secret), status(409));
  const pending = service.startTelegramLink(owner);
  service.unlinkTelegram(owner);
  update.message.text = `/start ${new URL(pending.url).searchParams.get('start')}`;
  assert.throws(() => service.acceptTelegramUpdate(update, secret), status(409));
});

test('replacing a link nonce invalidates old links, and disabled Telegram never exposes actions', t => {
  const { service } = setup(t);
  const old = service.startTelegramLink(owner);
  service.startTelegramLink(owner);
  assert.throws(() => service.acceptTelegramUpdate({ message: { text: `/start ${new URL(old.url).searchParams.get('start')}`, from: { id: 42 }, chat: { type: 'private', id: 42 } } }, secret), status(409));
  const disabled = setup(t, { telegram: undefined }).service;
  assert.equal(disabled.telegramStatus(owner).available, false);
  assert.throws(() => disabled.startTelegramLink(owner), status(503));
});

test('Telegram creation uses bound user, verifies once, and new content gets a separate set identity', async t => {
  const calls = [];
  const { service } = setup(t, { telegram: bot({ async createSet(args) { calls.push(args); return { name: args.name, url: `https://t.me/addstickers/${args.name}` }; } }) });
  const saved = service.save(owner, input());
  await assert.rejects(service.createTelegramSet(owner, saved.id, saved.revision), status(409));
  link(service);
  const first = await service.createTelegramSet(owner, saved.id, saved.revision);
  const again = await service.createTelegramSet(owner, saved.id, saved.revision);
  assert.deepEqual(first, again);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].userId, 42);
  assert.equal(calls[0].reconcileOnly, false);
  assert.equal(service.ownerGet(owner, saved.id).telegramURL, first.url);
  service.publish(owner, saved.id, saved.revision);
  assert.match(renderPackPage(service.publicGet(saved.id)), /Open sticker pack in Telegram/);
  service.unpublish(owner, saved.id);
  assert.throws(() => service.publicGet(saved.id), status(404));
  assert.equal(service.ownerGet(owner, saved.id).telegramURL, first.url); // External Telegram copies cannot be unpublished here.
  service.unlinkTelegram(owner);
  await assert.rejects(service.createTelegramSet(owner, saved.id, saved.revision), status(409));
  link(service, owner, 99);
  await assert.rejects(service.createTelegramSet(owner, saved.id, saved.revision), status(409));
  const revised = service.save(owner, { ...input(), id: saved.id, name: 'Next version' });
  const next = await service.createTelegramSet(owner, saved.id, revised.revision);
  assert.notEqual(next.name, first.name);
  assert.equal(calls[1].userId, 99);
});

test('an uncertain Telegram export reconciles durably without a second create', async t => {
  let count = 0;
  const adapter = bot({ async createSet(args) {
    count++;
    if (count === 1) { const error = new Error('Response lost'); error.uncertain = true; throw error; }
    assert.equal(args.reconcileOnly, true);
    return { name: args.name, url: `https://t.me/addstickers/${args.name}` };
  } });
  const { service, db } = setup(t, { telegram: adapter });
  const saved = service.save(owner, input()); link(service);
  await assert.rejects(service.createTelegramSet(owner, saved.id, saved.revision));
  assert.equal(service.ownerGet(owner, saved.id).telegramStatus, 'uncertain');
  const restarted = createDistributionService({ store: { db }, publicBaseURL: 'https://bias.example', telegram: adapter, webhookSecret: secret });
  assert.equal((await restarted.createTelegramSet(owner, saved.id, saved.revision)).status, 'verified');
});

const response = (result, errorCode) => ({ ok: !errorCode, status: errorCode || 200, async json() { return errorCode ? { ok: false, error_code: errorCode, description: result } : { ok: true, result }; } });
const remoteSet = name => ({ name, sticker_type: 'regular', stickers: Array.from({ length: 3 }, () => ({ width: 512, height: 512, is_animated: false, is_video: false })) });

test('real adapter uses multipart Bot API, proper owner/suffix, and verifies before exposing URL', async () => {
  const calls = []; let exists = false;
  const name = telegramSetName('pack', 1, 'bias_test_bot');
  const adapter = createTelegramAdapter({ token: 'test-token', username: 'bias_test_bot', request: async (url, options) => {
    const method = url.split('/').at(-1); calls.push(method);
    if (method === 'getMe') return response({ is_bot: true, username: 'bias_test_bot' });
    if (method === 'getStickerSet') return exists ? response(remoteSet(name)) : response('Bad Request: STICKERSET_INVALID', 400);
    assert.equal(method, 'createNewStickerSet');
    assert.ok(options.body instanceof FormData);
    assert.equal(options.body.get('user_id'), '42');
    assert.equal(options.body.get('name'), name);
    assert.deepEqual(JSON.parse(options.body.get('stickers'))[0], { sticker: 'attach://sticker0', format: 'static', emoji_list: ['💜'] });
    assert.equal(options.body.get('sticker0').type, 'image/webp');
    assert.deepEqual(Buffer.from(await options.body.get('sticker0').arrayBuffer()), validateStickerImage(image));
    exists = true; return response(true);
  } });
  const result = await adapter.createSet({ userId: 42, name, title: 'Reactions', stickers: input().stickers });
  assert.equal(result.url, `https://t.me/addstickers/${name}`);
  assert.deepEqual(calls, ['getMe', 'getStickerSet', 'createNewStickerSet', 'getStickerSet']);
  await adapter.createSet({ userId: 42, name, title: 'Reactions', stickers: input().stickers });
  assert.equal(calls.filter(method => method === 'createNewStickerSet').length, 1);
  assert.equal(calls.some(method => method.startsWith('send')), false);
  assert.ok(telegramSetName('pack', 1, 'a'.repeat(32)).length <= 64);
});

test('lost Telegram create response is reconciled; missing uncertain set never gets recreated', async () => {
  const name = telegramSetName('pack', 2, 'bias_test_bot');
  let created = false; let creates = 0;
  const adapter = createTelegramAdapter({ token: 'never-echo-this-token', username: 'bias_test_bot', request: async url => {
    const method = url.split('/').at(-1);
    if (method === 'getMe') return response({ is_bot: true, username: 'bias_test_bot' });
    if (method === 'getStickerSet') return created ? response(remoteSet(name)) : response('STICKERSET_INVALID', 400);
    creates++; created = true; throw new Error(`Network lost for ${url}`);
  } });
  assert.equal((await adapter.createSet({ userId: 42, name, title: 'Pack', stickers: input().stickers })).url, `https://t.me/addstickers/${name}`);
  created = false;
  await assert.rejects(adapter.createSet({ userId: 42, name, title: 'Pack', stickers: input().stickers, reconcileOnly: true }), error => error.status === 409 && error.uncertain && !error.message.includes('never-echo'));
  assert.equal(creates, 1);
});

test('adapter sanitizes transport errors, rejects bot mismatch and unverified set shape', async () => {
  const name = telegramSetName('pack', 1, 'bias_test_bot');
  const args = { userId: 42, name, title: 'Pack', stickers: input().stickers };
  const broken = createTelegramAdapter({ token: 'secret-token', username: 'bias_test_bot', request: async url => { throw new Error(url); } });
  await assert.rejects(broken.createSet(args), error => !error.message.includes('secret-token') && !error.uncertain);
  const mismatch = createTelegramAdapter({ token: 'test', username: 'bias_test_bot', request: async () => response({ is_bot: true, username: 'wrong_bot' }) });
  await assert.rejects(mismatch.createSet(args), status(503));
  const wrongSet = createTelegramAdapter({ token: 'test', username: 'bias_test_bot', request: async url => url.endsWith('getMe') ? response({ is_bot: true, username: 'bias_test_bot' }) : response({ ...remoteSet(name), stickers: [] }) });
  await assert.rejects(wrongSet.createSet(args), /does not match/);
});

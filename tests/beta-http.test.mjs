import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { unzipSync, strFromU8 } from 'fflate';
import { createBetaStore } from '../server/beta-store.mjs';
import { createGenerationService } from '../server/beta-generation.mjs';
import { createDistributionService } from '../server/beta-distribution.mjs';
import { createBetaServer } from '../server/beta-server.mjs';
import { runAdmin } from '../server/beta-admin.mjs';

const image = 'data:image/webp;base64,UklGRi4AAABXRUJQVlA4TCIAAAAv/8F/AAdQpAqWu/8BgUCyv/cMRfQ/4z//+c9//vOf//wf';
const output = { image: 'data:image/png;base64,iVBORw0KGgo=', model: 'mock-image-model' };
const pack = () => ({ name: 'Joy <script>private</script>', publisher: 'Creator & fandom', stickers: Array.from({length: 3}, () => ({image, emoji: '💜'})) });
const input = { requestId: 'request_http_0001', prompt: 'private generation prompt' };
async function boot(filename, generate = async () => output, options = {}) {
  const {telegram, webhookSecret, generationEnabled = true, ...storeOptions} = options;
  const store = createBetaStore({filename, ...storeOptions});
  const generation = createGenerationService({store, generate});
  const distribution = createDistributionService({store, publicBaseURL: 'https://beta.example.test', telegram, webhookSecret});
  const server = createBetaServer({store, generation, distribution, generationEnabled, telegramEnabled: !!telegram});
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, {method = 'GET', token, body, headers = {}} = {}) {
    return fetch(base + path, {method, headers: { ...(body !== undefined ? {'Content-Type':'application/json'} : {}), ...(token ? {Authorization: `Bearer ${token}`} : {}), ...headers}, ...(body !== undefined ? {body: JSON.stringify(body)} : {})});
  }
  async function session(label) {
    const invite = store.createInvite({label});
    const response = await request('/v1/session', {method:'POST', body:{code:invite.code}});
    assert.equal(response.status, 200);
    return response.json();
  }
  async function close() {
    await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
    await generation.close(); store.close();
  }
  return {store, generation, distribution, request, session, close};
}
async function fixture(t, generate, options) {
  const directory = mkdtempSync(join(tmpdir(), 'bias-http-'));
  const app = await boot(join(directory, 'beta.sqlite'), generate, options);
  t.after(async () => { await app.close(); rmSync(directory, {recursive:true,force:true}); });
  return app;
}

test('HTTP auth, CORS, logout and sanitized errors keep private routes private', async (t) => {
  const app = await fixture(t);
  assert.equal((await app.request('/v1/packs')).status, 401);
  assert.equal((await app.request('/v1/usage', {token:'invalid'})).status, 401);
  assert.equal((await app.request('/v1/session', {method:'POST',body:{code:'invalid'}})).status, 401);
  assert.equal((await app.request('/health', {headers:{Origin:'https://untrusted.example'}})).status, 403);
  const preflight = await app.request('/v1/jobs', {method:'OPTIONS',headers:{Origin:'http://localhost:8081'}});
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:8081');
  const signed = await app.session('Creator');
  assert.equal((await app.request('/v1/packs', {token:signed.token})).status, 200);
  assert.equal((await app.request('/v1/session', {method:'DELETE',token:signed.token})).status, 200);
  assert.equal((await app.request('/v1/packs', {token:signed.token})).status, 401);
});

test('HTTP finished pack is private until publish; anonymous page/image/ZIP revoke on unpublish', async (t) => {
  const app = await fixture(t);
  const {token} = await app.session('Editor <team>');
  const savedResponse = await app.request('/v1/packs', {method:'POST',token,body:pack()});
  assert.equal(savedResponse.status, 200);
  const saved = await savedResponse.json();
  assert.equal(saved.published, false);
  for (const path of [`/p/${saved.id}`, `/public/packs/${saved.id}`, `/public/packs/${saved.id}/images/0`, `/public/packs/${saved.id}/download`]) assert.equal((await app.request(path)).status, 404);
  const published = await app.request(`/v1/packs/${saved.id}/publish`, {method:'POST',token,body:{revision:saved.revision}});
  assert.equal(published.status, 200);
  const page = await app.request(`/p/${saved.id}`);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.ok(page.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
  const html = await page.text();
  assert.ok(html.includes('Created by Creator &amp; fandom'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('Open sticker pack in Telegram'));
  const preview = await (await app.request(`/public/packs/${saved.id}`)).json();
  assert.equal(preview.stickers[0].image, undefined);
  assert.equal(preview.stickers[0].imageURL, `https://beta.example.test/public/packs/${saved.id}/images/0`);
  const webp = await app.request(`/public/packs/${saved.id}/images/0`);
  assert.equal(webp.headers.get('content-type'), 'image/webp');
  assert.deepEqual(Buffer.from(await webp.arrayBuffer()), Buffer.from(image.split(',')[1], 'base64'));
  assert.equal((await app.request(`/public/packs/${saved.id}/images/3`)).status, 404);
  const download = await app.request(`/public/packs/${saved.id}/download`);
  assert.equal(download.headers.get('content-type'), 'application/zip');
  const zip = unzipSync(new Uint8Array(await download.arrayBuffer()));
  assert.deepEqual(Object.keys(zip).sort(), ['READ-ME.txt','collection.json','stickers/01.webp','stickers/02.webp','stickers/03.webp']);
  const manifest = JSON.parse(strFromU8(zip['collection.json']));
  assert.equal(manifest.format, 'bias-studio-finished');
  assert.equal(manifest.version, 1);
  assert.equal(manifest.publisher, pack().publisher);
  assert.deepEqual(Object.keys(manifest).sort(), ['format','id','name','publisher','stickers','version']);
  assert.deepEqual(manifest.stickers[0], {file:'stickers/01.webp',emoji:'💜'});
  assert.ok(strFromU8(zip['READ-ME.txt']).includes('does not install'));
  assert.deepEqual(Buffer.from(zip['stickers/01.webp']), Buffer.from(image.split(',')[1], 'base64'));
  assert.equal((await app.request(`/v1/packs/${saved.id}/unpublish`, {method:'POST',token})).status, 200);
  for (const path of [`/p/${saved.id}`, `/public/packs/${saved.id}`, `/public/packs/${saved.id}/images/0`, `/public/packs/${saved.id}/download`]) assert.equal((await app.request(path)).status, 404);
  assert.equal((await app.request(`/v1/packs/${saved.id}`, {token})).status, 200);
});

test('HTTP rejects source metadata and cross-creator collection operations', async (t) => {
  const app = await fixture(t);
  const first = await app.session('First'); const second = await app.session('Second');
  const invalid = await app.request('/v1/packs', {method:'POST', token:first.token, body:{...pack(),prompt:'private source'}});
  assert.equal(invalid.status, 400);
  const saved = await (await app.request('/v1/packs', {method:'POST', token:first.token, body:pack()})).json();
  for (const suffix of ['', '/publish', '/unpublish']) {
    assert.equal((await app.request(`/v1/packs/${saved.id}${suffix}`, {method:suffix?'POST':'GET',token:second.token,...(suffix === '/publish' ? {body:{revision:saved.revision}} : {})})).status, 404);
  }
  assert.deepEqual(await (await app.request('/v1/packs', {token:second.token})).json(), []);
  assert.equal((await app.request('/v1/telegram/link', {method:'POST',token:first.token})).status, 503);
});

test('HTTP idempotent generation reconnect, owner isolation and kept usage', async (t) => {
  let calls = 0;
  const app = await fixture(t, async () => {calls++; return output;});
  const first = await app.session('First'); const second = await app.session('Second');
  const response = await app.request('/v1/jobs', {method:'POST',token:first.token,body:input});
  assert.equal(response.status, 202);
  const job = await response.json();
  await app.generation.waitForIdle();
  const reconnect = await (await app.request('/v1/jobs', {method:'POST',token:first.token,body:input})).json();
  assert.equal(reconnect.id, job.id); assert.equal(reconnect.status, 'succeeded');
  assert.equal(calls, 1);
  assert.ok(!JSON.stringify(reconnect).includes(input.prompt));
  assert.equal((await app.request('/v1/jobs', {method:'POST',token:first.token,body:{...input,prompt:'changed'}})).status, 409);
  assert.equal((await app.request(`/v1/jobs/${job.id}`, {token:second.token})).status, 404);
  assert.equal((await app.request(`/v1/jobs/${job.id}/kept`, {method:'POST',token:first.token,body:{kept:true}})).status, 200);
  const usage = await (await app.request('/v1/usage', {token:first.token})).json();
  assert.equal(usage.kept, 1); assert.equal(usage.attempts, 1); assert.equal(usage.estimateIsActualSpend, false);
});

test('HTTP stale running job reconnect after worker restart never dispatches twice', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bias-http-restart-'));
  const filename = join(directory, 'beta.sqlite');
  let calls = 0; let app;
  try {
    app = await boot(filename, () => {calls++; return new Promise(() => {});});
    const {token} = await app.session('Restart creator');
    const job = await (await app.request('/v1/jobs', {method:'POST',token,body:input})).json();
    assert.equal(calls, 1);
    await app.close();
    app = await boot(filename, async () => {calls++; return output;});
    const recovered = await (await app.request('/v1/jobs', {method:'POST',token,body:input})).json();
    assert.equal(recovered.id, job.id);
    assert.equal(recovered.status, 'interrupted');
    assert.equal(calls, 1);
    assert.equal((await (await app.request('/v1/usage', {token})).json()).attempts, 1);
  } finally { if (app) await app.close(); rmSync(directory, {recursive:true,force:true}); }
});

test('admin invite and consistent backup are exclusive 0600 outputs; revoke disables all credentials', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bias-admin-'));
  const filename = join(directory, 'beta.sqlite'); const inviteFile = join(directory, 'invite.json'); const backupFile = join(directory, 'backup.sqlite');
  let store;
  try {
    await assert.rejects(runAdmin(['invite','--label','Creator'], {filename}));
    const message = await runAdmin(['invite','--label','Creator','--output',inviteFile,'--quota','3'], {filename});
    const invite = JSON.parse(readFileSync(inviteFile,'utf8'));
    assert.ok(!message.includes(invite.code));
    assert.equal(statSync(inviteFile).mode & 0o777, 0o600);
    await assert.rejects(runAdmin(['invite','--label','Other','--output',inviteFile], {filename}));
    store = createBetaStore({filename});
    assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM beta_creators').get().n, 1);
    const session = store.exchangeInvite(invite.code);
    await runAdmin(['backup','--output',backupFile], {filename});
    assert.equal(statSync(backupFile).mode & 0o777, 0o600);
    const copied = new DatabaseSync(backupFile, {readOnly:true});
    assert.equal(copied.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    assert.equal(copied.prepare('SELECT COUNT(*) AS n FROM beta_sessions').get().n, 1);
    copied.close();
    await assert.rejects(runAdmin(['backup','--output',backupFile], {filename}));
    await runAdmin(['revoke','--creator',invite.creator.id], {filename});
    assert.throws(() => store.exchangeInvite(invite.code), (error) => error.status === 401);
    assert.throws(() => store.authenticate(session.token), (error) => error.status === 401);
  } finally { store?.close(); rmSync(directory,{recursive:true,force:true}); }
});

test('admin prune expires only old terminal payloads and preserves quota/idempotency/kept metrics', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bias-prune-'));
  const filename = join(directory, 'beta.sqlite');
  const old = Date.UTC(2026,0,1); let time = old;
  const store = createBetaStore({filename,now:()=>time});
  const owner = store.createInvite({label:'Retention'}).creator;
  const generation = createGenerationService({store,generate:async()=>output});
  try {
    const job = generation.submit(owner,input); await generation.waitForIdle();
    generation.markKept(owner,job.id,true);
    time += 60 * 86400000;
    const recent = generation.submit(owner,{...input,requestId:'request_recent_01'}); await generation.waitForIdle();
    const before = generation.usage(owner);
    await assert.rejects(runAdmin(['prune','--before',new Date(time).toISOString()],{filename,now:()=>time}));
    const summary = await runAdmin(['prune','--before',new Date(old+86400000).toISOString()],{filename,now:()=>time});
    assert.ok(summary.includes('1 terminal job'));
    assert.equal(generation.get(owner,job.id).resultExpired,true);
    assert.equal(generation.get(owner,job.id).result,undefined);
    assert.deepEqual(generation.get(owner,recent.id).result,output);
    assert.equal(generation.submit(owner,input).id,job.id);
    assert.deepEqual(generation.usage(owner),before);
  } finally { await generation.close(); store.close(); rmSync(directory,{recursive:true,force:true}); }
});

test('HTTP stale publication and Telegram confirmations reject a newer private revision', async (t) => {
  let creates = 0;
  const telegram = {
    username: 'bias_test_bot',
    setName: (id, revision) => `bias_${id}_${revision}_by_testbot`,
    createSet: async ({name}) => { creates++; return {name,url:`https://t.me/addstickers/${name}`}; },
  };
  const webhookSecret = 'test-only-webhook-authentication';
  const app = await fixture(t, undefined, {telegram,webhookSecret});
  const {token} = await app.session('Revision creator');
  const original = await (await app.request('/v1/packs', {method:'POST',token,body:pack()})).json();
  const link = await (await app.request('/v1/telegram/link', {method:'POST',token})).json();
  const nonce = new URL(link.url).searchParams.get('start');
  const linked = await app.request('/v1/telegram/webhook', {method:'POST',headers:{'x-telegram-bot-api-secret-token':webhookSecret},body:{message:{text:`/start ${nonce}`,from:{id:10001,is_bot:false},chat:{id:10001,type:'private'}}}});
  assert.equal(linked.status, 200);
  const duplicate = await app.request('/v1/telegram/webhook', {method:'POST',headers:{'x-telegram-bot-api-secret-token':webhookSecret},body:{message:{text:`/start ${nonce}`,from:{id:10001,is_bot:false},chat:{id:10001,type:'private'}}}});
  assert.equal(duplicate.status, 200, 'duplicate delivery acknowledges without rebinding');
  const forged = await app.request('/v1/telegram/webhook', {method:'POST',headers:{'x-telegram-bot-api-secret-token':'wrong'},body:{message:{text:`/start ${nonce}`,from:{id:10002,is_bot:false},chat:{id:10002,type:'private'}}}});
  assert.equal(forged.status, 401);
  // Another save wins after the creator inspected revision 1 and before confirming distribution.
  const updatedResponse = await app.request('/v1/packs', {method:'POST',token,body:{...pack(),id:original.id,name:'New private edit'}});
  assert.equal(updatedResponse.status, 200);
  const updated = await updatedResponse.json();
  assert.equal(updated.revision, original.revision + 1);
  for (const action of ['publish','telegram']) {
    const stale = await app.request(`/v1/packs/${original.id}/${action}`, {method:'POST',token,body:{revision:original.revision}});
    assert.equal(stale.status, 409, `stale ${action} must reject`);
  }
  assert.equal(creates, 0);
  assert.equal((await app.request(`/p/${original.id}`)).status, 404);
  const privatePack = await (await app.request(`/v1/packs/${original.id}`, {token})).json();
  assert.equal(privatePack.published, false);
  assert.equal(privatePack.telegramURL, null);
  assert.equal((await app.request(`/v1/packs/${original.id}/publish`, {method:'POST',token,body:{revision:updated.revision}})).status, 200);
  assert.equal((await app.request(`/v1/packs/${original.id}/telegram`, {method:'POST',token,body:{revision:updated.revision}})).status, 200);
  assert.equal(creates, 1);
});

test('HTTP lost POST response recovers completed output while new generation is disabled', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bias-http-cutoff-'));
  const filename = join(directory, 'beta.sqlite');
  let calls = 0; let app;
  try {
    app = await boot(filename, async () => {calls++; return output;});
    const {token} = await app.session('Cutoff creator');
    const original = await (await app.request('/v1/jobs', {method:'POST',token,body:input})).json();
    await app.generation.waitForIdle();
    const before = await (await app.request('/v1/usage', {token})).json();
    await app.close();
    app = await boot(filename, async () => {calls++; return output;}, {generationEnabled:false});
    const response = await app.request('/v1/jobs', {method:'POST',token,body:input});
    assert.equal(response.status, 202);
    const recovered = await response.json();
    assert.equal(recovered.id, original.id);
    assert.equal(recovered.status, 'succeeded');
    assert.deepEqual(recovered.result, output);
    assert.equal((await app.request('/v1/jobs', {method:'POST',token,body:{...input,requestId:'request_disabled'}})).status, 503);
    await app.generation.waitForIdle();
    assert.equal(calls, 1);
    assert.deepEqual(await (await app.request('/v1/usage', {token})).json(), before);
  } finally { if (app) await app.close(); rmSync(directory,{recursive:true,force:true}); }
});

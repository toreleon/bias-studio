import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerWebhook } from '../server/telegram-setup.mjs';
test('operator webhook setup is explicit, secret-authenticated and never sends a message', async () => {
  let calls=0;
  const config={token:'test-token',secret:'test-secret-with-24-characters',publicURL:'https://packs.example',request:async(url,options)=>{
    calls++; assert.match(url,/\/setWebhook$/);
    assert.deepEqual(JSON.parse(options.body),{url:'https://packs.example/v1/telegram/webhook',secret_token:config.secret,allowed_updates:['message'],drop_pending_updates:false});
    return Response.json({ok:true,result:true});
  }};
  assert.deepEqual(await registerWebhook(config),{registered:true});
  assert.equal(calls,1);
  await assert.rejects(registerWebhook({...config,publicURL:'http://packs.example'}));
  await assert.rejects(registerWebhook({...config,secret:'short'}));
  assert.equal(calls,1);
  await assert.rejects(registerWebhook({...config,request:async()=>{throw new Error('test-token');}}),e=>!e.message.includes('test-token'));
});

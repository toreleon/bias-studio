import { pathToFileURL } from 'node:url';

/** Explicit operator action after deployment approval; never sends a Telegram message. */
export async function registerWebhook({token,secret,publicURL,request=fetch}) {
  const base = new URL(publicURL);
  if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash)
    throw new Error('Configure an HTTPS public origin first.');
  if (!token || !/^[a-zA-Z0-9_-]{24,256}$/.test(secret || ''))
    throw new Error('Configure the bot token and a 24–256 character webhook secret using letters, numbers, underscores or hyphens.');
  try {
    const response = await request(`https://api.telegram.org/bot${token}/setWebhook`, {
      method:'POST', headers:{'Content-Type':'application/json'}, signal:AbortSignal.timeout(30000),
      body:JSON.stringify({url:`${base.origin}/v1/telegram/webhook`,secret_token:secret,allowed_updates:['message'],drop_pending_updates:false}),
    });
    const result = await response.json();
    if (!response.ok || result.ok !== true || result.result !== true) throw new Error();
    return {registered:true};
  } catch { throw new Error('Telegram did not confirm webhook registration. Check server configuration; no credentials or upstream response are shown.'); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] !== 'register') {
    console.log('After deployment approval: node --env-file=server/.env.local server/telegram-setup.mjs register. Changes the configured bot webhook; use a dedicated beta bot.');
  } else {
    try {
      await registerWebhook({token:process.env.TELEGRAM_BOT_TOKEN,secret:process.env.TELEGRAM_WEBHOOK_SECRET,publicURL:process.env.BETA_PUBLIC_URL});
      console.log('Telegram confirmed webhook registration. Test creator linking before enabling the pilot.');
    } catch { console.error('Webhook registration failed. Check the HTTPS origin and private bot configuration.'); process.exitCode=1; }
  }
}

# Private beta deployment and operating guide

Prepared 2026-11-17. This is a deployable proposal, **not evidence of a public deployment**. No hosting, DNS, public data upload, Telegram set creation or store release is authorized by this document alone. Review [verification](BETA-VERIFICATION.md) and obtain the owner's deployment approval first.

## Proposed service

One small Linux host runs one Node 24 service, one private persistent SQLite volume and Caddy for HTTPS. Public routes serve collection HTML, rendered WebP previews and finished ZIP files. The same service authenticates invited creators, runs durable GPT Image jobs and connects Telegram. It does not need Redis, a separate queue or a paid database for a small pilot. **Run one generation worker per database; do not scale this configuration to replicas.**

The mobile app remains useful offline. It stores drafts/library locally and uses `EXPO_PUBLIC_BETA_URL` only for online features. The public recipient page does not require an account. Native `biasstudio://receive/<id>` links open an already-installed beta app; there is no store listing or universal-link association. WhatsApp requires the native app. Telegram links appear only after the Bot API verifies a set.

| Data | Location / exposure |
| --- | --- |
| Original photos, video frames, editable designs and recipes | Local workspace; included only in explicitly selected editable ZIP exports |
| Generation description/reference | Sent to the private service and OpenAI after user confirmation; queued input stored privately, terminal input logically cleared |
| Generation output, status, hashed request identity, quota/reservation ledger | Private SQLite; owner-authenticated recovery; result payloads may be pruned after at least 30 days |
| Creator invite/session | Random opaque values, only hashes in SQLite; session token kept in app memory, expires after seven days; creator invite must be kept private |
| Finished pack, creator credit and account display name | Private cloud copy initially; anonymous HTML/images/ZIP only after explicit publish |
| Telegram user ID and linking nonce | Private backend; nonce stored hashed, expires after ten minutes and is single use |
| Telegram sticker copy | Telegram after explicit export; unpublishing Bias Studio cannot revoke this copy or previously downloaded ZIPs |

`Cache-Control: no-store` applies to public pages/images/downloads. Unpublish checks at each request. No access/request-content logging or analytics beacon is included. Operator/network logs and OpenAI/Telegram retention are separate. Private local storage is not encrypted by this app; protect devices and server disks. Browser storage remains finite despite bounded image compression.

## Local service, without public exposure

Use Node **22.16+** (Node 24 recommended), npm and the existing checkout:

```bash
npm ci
cp server/.env.example server/.env.local
chmod 600 server/.env.local
```

Edit the file directly on the server or in a secret manager. Never paste keys into chat, put them in `EXPO_PUBLIC_*`, commit them, or pass them as command-line arguments. Rotate any provider credential previously shared in a conversation. Empty OpenAI/Telegram credentials leave those destination actions unavailable. `BETA_PUBLIC_URL` accepts HTTPS origins, or localhost HTTP for development only.

```bash
npm run beta:serve
```

In another terminal create an individual invitation (use a public-facing creator label):

```bash
mkdir -p server/data/operator
npm run beta:invite -- --label "Pilot Creator" --output server/data/operator/creator.invite --quota 20
```

The code is written to an exclusive `0600` file, not printed. Deliver it privately through your own approved channel. An invite is reusable until revoked; it is the beta account credential, not a public referral code. Do not share one invite among creators. Revocation command:

```bash
node --env-file=server/.env.local server/beta-admin.mjs revoke --creator CREATOR_ID
```

For a browser pointed at local backend:

```bash
EXPO_PUBLIC_BETA_URL=http://localhost:8788 npm run web
```

Physical phones cannot reach a computer's localhost; rebuild with the approved public HTTPS origin. No API key belongs in the mobile bundle. Changing the origin requires restarting Metro/rebuilding exported apps.

## HTTPS deployment after approval

Required external inputs: chosen host/account and deployment access, owned hostname/DNS, a rotated OpenAI project key configured securely, and a Telegram bot token/username. No external provider was provisioned by this change.

1. Provision an approved single Linux host with Docker Compose, private encrypted persistent disk and sufficient backup space. Starting assumption: 1–2 vCPU, 1–2 GB RAM, 20 GB disk. Restrict inbound traffic to SSH, 80 and 443; do not expose 8788.
2. Point the owned hostname to the host. Copy the reviewed source, create `server/.env.local` with mode `0600`, and set the provider credentials and budget settings.
3. Set the **non-secret** `PUBLIC_HOST` in your shell or a private deployment environment file. Set `WEB_ORIGIN` only if the browser app is hosted at a different origin. Native requests do not use browser CORS.
4. Review the configuration without printing resolved secrets: `docker compose -f deploy/compose.yaml config --quiet`.
5. Run the approved deployment:

```bash
export PUBLIC_HOST=packs.your-owned-domain.example
docker compose -f deploy/compose.yaml up -d --build
docker compose -f deploy/compose.yaml ps
curl --fail --silent "https://$PUBLIC_HOST/health"
```

The compose environment overrides the local bind/database/public-origin values. Caddy requests and renews a real certificate; DNS and ports must work. HTTP redirects to HTTPS. The database volume persists across image replacement. **Never run `down -v` against pilot data.** The image is non-root, read-only, and contains only service source/dependencies. `.dockerignore` excludes keys, databases and app artifacts. Builds behind a custom certificate proxy may supply the public trust certificate as BuildKit secret `npm_ca`; TLS verification stays enabled.

The provided container smoke test uses no network, provider keys, public ports or persistent customer data:

```bash
bash scripts/check-beta-container.sh
```

## Telegram setup

Create/configure a bot through Telegram's own tooling. Store `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` and a random `TELEGRAM_WEBHOOK_SECRET` of at least 24 characters in server configuration. Once HTTPS is approved and working, register a webhook at:

`https://<PUBLIC_HOST>/v1/telegram/webhook`

After approval, run `node --env-file=server/.env.local server/telegram-setup.mjs register` with `BETA_PUBLIC_URL` set to the deployed HTTPS origin. The script uses Bot API `setWebhook` with `secret_token` set to the configured webhook secret and `allowed_updates: ["message"]`. Do this through a private operator script/secret manager; do not put the bot token in a terminal URL or saved shell history. Registering the webhook changes the bot's existing receiver, so check that it is dedicated to this beta. The app issues a one-use `/start` link; the creator taps Start in their private Telegram chat and checks connection in Bias Studio. The backend derives identity from the secret-verified Telegram update. It never trusts a user-submitted numeric ID and does not send unsolicited messages.

Creating a set calls `getMe`, `getStickerSet`, multipart `createNewStickerSet`, and `getStickerSet` again. Only a verified matching set gets an `https://t.me/addstickers/...` link. Names are deterministic per pack revision. A lost response becomes uncertain and subsequent attempts reconcile the existing name without issuing another create. If that name still does not exist, it remains check-only; investigate with the operator instead of blindly resubmitting. New revisions start private and have a separate set identity. This implementation validates static 512×512 WebP envelopes/dimensions; it does not fully decode arbitrary WebP on the server.

## Budgets and cost assumptions

The selected default is `gpt-image-2.6-sunburst`, low quality, 1024×1024, one image per request with transparent PNG output. Keep it configurable for account availability. OpenAI's current [image generation guide](https://developers.openai.com/api/docs/guides/image-generation) quotes an example of **$0.02469 output cost** for low 1024×1024 GPT-Image-2.6; prompt/reference input is additional. Verify current pricing before deployment. `gpt-image-1.5` is [scheduled to shut down December 1, 2026](https://developers.openai.com/api/docs/deprecations); older repository screenshots are historical evidence, not validation of the new model.

Default application controls are 20 attempts/creator/UTC day, 100 globally/day, concurrency two, and $0.05 configured reservation/attempt with a $5 daily reservation limit. These are durable admission controls and **estimated reservations, not a hard provider-dollar cap or actual billed spend**. Failed, cancelled and uncertain dispatched attempts keep their reservations. A model/input price change can exceed the estimate. Set separate OpenAI project alerts/limits where supported; monitor invoices/usage and reconcile estimates under [the pilot cost protocol](PILOT.md).

Planning example, not a quote: 20 creators × 2 packs/week × 6 generated reactions × 4 weeks = 960 attempts/month before retries. Output-only at the cited example is about $23.70; using a $0.05 planning allowance gives $48/month including assumed input/retry headroom, which must be measured. If every daily slot is used for 30 days, configured reservations total $150. Photo/clip-only packs make no generation calls. Host + backup planning allowance: $10–25/month; domain: $10–20/year; these are vendor-neutral budget assumptions, not verified offers. Telegram Bot API set creation has no billing implemented here; bandwidth/provider policies still apply. No payment has been incurred by this deployment plan.

At 100 generation attempts/day and a hypothetical average 1 MiB stored result, 30 days adds roughly 3 GB before SQLite/WAL/backups. Raw configured maximum outputs are larger; watch disk use. Pack uploads are capped at 50 collections and 50 MiB rendered data per creator. Quota does not replace disk monitoring. Alert well before disk exhaustion and retain only the pilot duration needed.

## Backup, retention and rollback

```bash
npm run beta:backup -- --output server/data/operator/backup-YYYYMMDD.sqlite
node --env-file=server/.env.local server/beta-admin.mjs prune --before YYYY-MM-DDT00:00:00Z
```

Prune requires an explicit cutoff at least 30 days old and removes terminal payloads while preserving quota/idempotency/retained-result accounting. Cleared images report `resultExpired`; a retry must never silently create a paid replacement. Logical deletion does not erase prior SQLite pages/WAL/backups. Keep encrypted private backups under an explicit retention schedule (pilot proposal: daily backups retained seven days; creator-approved published packs until withdrawal or pilot end). Test restoration to a separate private path, not over the active DB. Stop the service before offline SQLite checkpoint/VACUUM or restoring a consistent backup. Archive only synthetic test data in review artifacts.

To roll back, stop admissions, take a consistent backup, and deploy the previous **compatible beta image** against the preserved volume. Do not point the old in-memory generation server at beta traffic. On restart dispatched jobs become interrupted; queued jobs can resume, and the app recovers by the same request IDs. The local v1/v2 workspace migration keeps its backup key. CI/release approval and physical-device signoff are unchanged; a public backend deployment is separate from an app-store release.

## Concrete approval needed

Approve the above one-host service, hostname, persistent private data, explicit per-pack publication and planning budget; provide deployment access and configure provider/bot credentials through a secure channel. Then validate HTTPS, actual Telegram add/send and WhatsApp iPhone/Android handoff on real devices. Until those steps happen, treat public rollout and real destination use as blocked, not complete.

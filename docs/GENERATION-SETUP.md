# GPT Image generation in the private beta

The current app uses the authenticated **beta service** for durable generation jobs, account allowances and result recovery. The service also hosts finished-pack distribution. Run `npm run beta:serve`; `npm run generation:serve` remains a legacy local adapter harness and does not satisfy the current UI's session/job contract.

The beta entry point defaults to **`gpt-image-2.6-sunburst`**, with the model selected server-side through `GENERATION_MODEL`. OpenAI's [deprecation schedule](https://developers.openai.com/api/docs/deprecations) lists `gpt-image-1.5` shutdown on December 1, 2026. The earlier 1.2 live browser test used 1.5 and is historical evidence only. The current model/service needs its own bounded live validation; automated tests use injected provider responses.

Provider keys belong only in server secret configuration. Never put them in Expo public variables, mobile bundles, invite codes or Git. The client accepts a creator invite rather than a provider key.

## Local setup

Use **Node 22.16 or newer** for built-in SQLite. From the repository root:

```sh
npm ci
cp server/.env.example server/.env.local
chmod 600 server/.env.local
```

Edit `server/.env.local` privately. Set `OPENAI_API_KEY` only when live generation is intended. Leaving it empty allows local publishing tests while generation is reported unavailable. Keep the sample localhost origins for development. Do not paste secrets into chat or command output.

Create an individual invite and write it to a private file; the CLI does not print the code:

```sh
npm run beta:invite -- --label "Pilot creator 01" --quota 20 --output ./server/data/creator-01.invite
npm run beta:serve
```

The output file must not already exist. Give its invite code to that creator through an approved private channel; an invite is reusable until revoked and should be treated as a credential. It exchanges for a seven-day server session. The mobile/browser client keeps the session in memory only; reconnect after restart. Use a public-safe creator pseudonym: collection pages display this account label alongside the chosen pack credit, as disclosed in publication confirmation.

In another terminal:

```sh
EXPO_PUBLIC_BETA_URL=http://localhost:8788 npm run web
```

`EXPO_PUBLIC_BETA_URL` is the primary public configuration value; `EXPO_PUBLIC_GENERATION_URL` remains a URL fallback for compatibility, but the current app still expects the **beta** session/job API. Do not point the new UI at the legacy `/v1/stickers` harness.

For environments needing an outbound proxy, preserve the proxy and CA settings. Node 24 can use `NODE_USE_ENV_PROXY=1 npm run beta:serve`. Do not disable TLS verification.

## App flow and recovery

1. Open **Create with AI**, enter a subject, optionally select a reference, and choose a look/reactions. Selecting a reference or saving a recipe does not itself upload it.
2. Generate one sample after the explicit upload confirmation and creator sign-in. Inspect its expression, edges and likeness; approve it before generating the remaining reactions.
3. Optionally use the approved sample as the consistency reference. This helps express intent, not guarantee identical identity. Captions are applied separately and remain editable.
4. Choose individual variations only when wanted. Each variation uses a new request/allowance; keep useful candidates and form an editable pack.
5. **Pause monitoring** stops local waiting, not the server job. Reopen and **Recover saved requests** to retrieve the same job after a lost connection. Stable request IDs prevent duplicate admission when the same request is replayed.
6. Explicit cancellation asks the service to stop. A provider may already have processed or billed it. An interrupted/uncertain job is not automatically regenerated; review before choosing another paid attempt.

Successful results are saved locally as completed candidates and can be reused independently. The client persists immutable attempt details before submitting; the service rejects reusing the same request ID with different input. If a retained server result has been pruned, an existing local copy remains safe; starting a new variation is not free recovery.

## Service settings and limits

| Setting | Default and meaning |
| --- | --- |
| `BETA_DB` | `./server/data/beta.sqlite`; private persistent SQLite file, including its WAL sidecars |
| `BETA_HOST` / `BETA_PORT` | `127.0.0.1` / `8788` locally |
| `BETA_PUBLIC_URL` | `http://localhost:8788`; use the actual HTTPS origin when deployed |
| `BETA_WEB_ORIGIN` | `http://localhost:8081`; exact permitted browser origin |
| `BETA_CREATOR_DAILY_LIMIT` | 20 default attempts; individual account quota is set when issued |
| `BETA_DAILY_LIMIT` | 100 admitted attempts per UTC day across creators |
| `BETA_RESERVATION_MICROS` | 50,000 micro-USD ($0.05) configured estimate per admitted job |
| `BETA_DAILY_BUDGET_MICROS` | 5,000,000 micro-USD ($5) daily reservation ceiling |
| `GENERATION_MODEL` | `gpt-image-2.6-sunburst` in the beta entry point/example |

**These monetary defaults are configurable admission estimates, not verified model prices or guarantees of actual spend.** Validate a conservative allowance against current provider pricing and request settings before paid use; use provider-side controls and reconcile billing separately. The server retains reservations for failed, canceled and uncertain attempts rather than freeing allowance that could cause more paid work. Its usage endpoint explicitly marks estimates as not actual spend. It does not contain an automatic invoice reconciliation system. See [PILOT.md](PILOT.md) for actual cost per unique kept output.

The beta worker processes up to two jobs concurrently and uses a 150-second provider deadline. Run **one service/generation worker per SQLite database**; this is not a multi-replica deployment. SQLite transactions protect admission and idempotency. Restart preserves quotas/results and resumes queued work; formerly running work is marked interrupted instead of being blindly paid for again.

Inputs are limited to 8 MiB; references must be embedded PNG/JPEG/WebP, not arbitrary remote URLs. The image adapter requests one low-quality, transparent 1024-square PNG per job, then the client normalizes it for editable storage. Model compatibility, transparency and quality must be verified with the selected model. API success does not prove an acceptable likeness or chat reaction.

## Private storage and operations

Invite/session secrets are stored as hashes. Generation inputs are stored privately while queued/running and cleared on terminal completion; successful image results and numeric provider usage are stored for owner-only recovery. Private database pages, WAL files and backups need restricted access, encryption/storage policy and retention. Application code avoids logging prompts, images, authorization and raw provider errors; hosting/proxy logs and provider retention require separate configuration.

Operator commands from the repository root:

```sh
npm run beta:backup -- --output ./server/data/beta-backup.sqlite
node --env-file=server/.env.local server/beta-admin.mjs revoke --creator CREATOR_ID
node --env-file=server/.env.local server/beta-admin.mjs --help
```

Backups use SQLite's consistent online backup API and private file permissions. Use a fresh output filename. Revocation disables the reusable invite and existing sessions; ownership and usage records remain. The app's Disconnect control clears its in-memory session, while operator revocation applies server-side.

The administrator's `prune --before` command takes an explicit UTC cutoff at least 30 days old and logically removes terminal job inputs/results, while keeping idempotency, quota, status and reservation records. This is a manual operator action, not an automatic retention promise. Old pages, WAL and backups may retain bytes; follow the documented offline checkpoint/VACUUM and backup-retention procedure when physical reclamation is needed. Published collections are unaffected by generation pruning.

## HTTPS deployment and verification

A phone needs a reachable **HTTPS** `EXPO_PUBLIC_BETA_URL` bundled into its build. `localhost` on a phone means that phone. Local HTTP is a browser-development allowance; it does not relax native cleartext policy.

[BETA-DEPLOYMENT.md](BETA-DEPLOYMENT.md) describes the container, persistent volume, TLS/origin configuration, bot webhook, backups and approval requirements. The repository includes implementation and deployment preparation, **not an activated public endpoint**. Do not run multiple generation workers against the same DB. Preserve authorization headers and protect the database/secret files from static hosting.

`npm run check` includes injected provider/service tests; browser workflows use fixtures and make no paid calls. [BETA-VERIFICATION.md](BETA-VERIFICATION.md) records current checks and remaining live/device work. [VERIFICATION.md](VERIFICATION.md) describes earlier 1.2 observations only. Native builds and localhost browser success do not establish live generation or destination installation on physical phones.

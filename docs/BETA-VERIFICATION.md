# Beta verification and review guide

2026-11-17 · version 1.3.0 · branch `feat/fandom-beta`, based on the existing creator workspace. Review this as the next layer over PR #5; do not bypass its review or the protected-main release gate.

## Verified locally

| Check | Result / boundary |
| --- | --- |
| Zero-warning ESLint and TypeScript | Passed |
| TypeScript domain/client/archive/migration tests | 32 passed |
| Server generation/distribution/HTTP/operator tests | 43 passed; actual HTTP + SQLite, provider and Telegram transports mocked |
| Release policy | 8 passed; protected main, exact CI evidence, approvals and device signoff remain required |
| Browser workflows | 22 passed in Chromium, 390px mobile viewport; no test retries needed |
| Android | Release ARM64 APK compiled; `lintVitalRelease` passed; not run on a physical phone |
| Browser export | Production Expo web bundle exported successfully |
| Backend container | Built; booted non-root/read-only, network disabled, no credentials/public ports; unavailable integrations stayed disabled |
| HTTPS proxy configuration | Caddy configuration validated; no public certificate/DNS deployment performed |
| Actual app + backend recipient flow | UI rendered/uploaded a demo pack to loopback HTTP/ephemeral SQLite; anonymous recipient imported the actual server ZIP; unpublish then returned 404 |
| Screenshots | Seven actual running mobile-browser screens, not design mockups or device screenshots |

The 105 automated tests include imported photos, multiple video timestamps, batch styling, manual mask output, autosave/reopen, independent second-pack reuse, original-key migration, legacy duplicate-ID regression, storage failure/retry, finished/editable ZIP separation, partial generation, sample approval, immutable request recovery, cross-account recovery rejection, quotas, unknown provider outcomes, private ownership, publication revision races and stale Telegram confirmation rejection.

Publication/Telegram browser tests intercept transport for deterministic failure cases. The screenshot capture separately exercises **real local frontend-to-backend HTTP** without network interception. It uses original illustrative demo stickers, an ephemeral creator and no external publication. No new paid generation request or real Telegram create was made for this beta verification. Existing 1.2 GPT Image 1.5 results remain historical evidence only; they do not validate GPT-Image-2.6 quality, cost or account access.

## CI and test artifacts

CI still requires Quality, Browser and web build, Android native build, iOS native build and the aggregate CI gate. Quality additionally builds/smoke-tests the private service container. Use the beta PR's **latest required checks** as the source of truth for remote results and exact commit. The workflow provides an Android test APK, web-preview ZIP and an **unsigned iOS Simulator ZIP**. A Simulator app cannot be installed on a physical iPhone. No app-store release or protected-main merge is included.

The locally built Android APK and exported web preview have no production backend origin. They support local creation/import/library/export; online generation/publishing requires a rebuild with the approved HTTPS `EXPO_PUBLIC_BETA_URL`. Do not treat an unconfigured action as live service availability.

## Reproduce the acceptance scenario

```bash
npm ci
npm run check
npm run test:release
npx playwright install chromium
CI=1 npm run test:e2e
npm run export:web
bash scripts/check-beta-container.sh
```

If Chromium is already installed, set `CHROMIUM_PATH=/usr/bin/chromium`. CI starts a fresh Expo server; local tests may reuse port 8081. They use the test service origin `http://localhost:8787`; do not point them at production.

For hands-on review:

1. Start the app, import three photos or keep three moments from a clip. Style the selected set, customize a caption and save a style plus reactions to Library.
2. Close/reopen. Confirm images, captions, timestamps and style are intact.
3. From Library select the saved reactions and create another pack. Apply the saved style and edit one caption. Confirm the first pack is unchanged. Automation verifies correctness, **not that real creators are faster**; measure time in the pilot.
4. Preview in chat. Download/share the default finished ZIP and inspect that no originals, source layers, tags, timestamps or prompts are included. Choose the separate editable-source action only when intending to share those assets.
5. Start the local service and an individual invite using [setup](BETA-DEPLOYMENT.md). Add creator credit, connect, explicitly publish and open the page in an anonymous browser. Import its ZIP, then unpublish and confirm new requests fail. The finished copy already downloaded remains available.
6. With an approved live service: link a dedicated Telegram bot, create a set, open its verified link, tap Add Stickers and actually send one to a consenting recipient. On native WhatsApp, confirm Add and send a sticker. Record those steps separately from links/handoff.

For reproducible screenshots and a real **local** recipient integration check, start Expo with `EXPO_PUBLIC_BETA_URL=http://localhost:8787` on port 8081, leave 8787 free, then run:

```bash
CHROMIUM_PATH=/usr/bin/chromium node scripts/capture-beta.mjs
```

The script starts/closes an ephemeral loopback service, never loads `.env.local`, never calls a provider, and records metadata in `docs/screenshots/beta/capture.json`. [Home](screenshots/beta/01-home.png), [Pack](screenshots/beta/02-pack.png), [Editor](screenshots/beta/03-editor.png), [Library](screenshots/beta/04-library.png), [Preview](screenshots/beta/05-preview.png), [Public collection](screenshots/beta/06-public-pack.png), [AI sample setup](screenshots/beta/07-ai-sample.png).

## Real external blockers and remaining limits

- **Public HTTPS:** host, hostname/DNS and explicit deployment approval are needed. Container and Caddy configuration are prepared; no collection has been published on the public internet.
- **GPT Image:** rotate the key previously shared in chat and configure the replacement only on the server. The default current model is configurable; live account availability, output consistency, latency and actual cost remain unverified for this beta.
- **Telegram:** needs a dedicated bot token/username and registered secret-authenticated HTTPS webhook. Contract/error recovery tests passed; actual bot/recipient add-and-send has not been tested.
- **WhatsApp:** physical iPhone and Android checks remain: missing app, cancellation/rejection, WhatsApp Business availability, min/max packs, repeated revision handoff, add and send. Native bridge truthfully reports handoff; it cannot confirm installation. Provider compilation is not this validation.
- **iPhone distribution:** signing/team/provisioning access is required for a physical-device build. CI's Simulator artifact is useful only in Simulator.
- **Storage:** browser libraries remain bounded by browser storage; the 128 KiB encoded-image cap reduces pressure but is not unlimited storage. Drafts aren't cloud synced. Selected frames become durable after Add to pack; closing a still-open selection sheet discards that uncommitted selection.
- **Operations:** single generation worker per private SQLite database; no replica guarantee. Reservations are estimates, not invoices. Retention/backup procedures require an operator. Unpublishing cannot revoke Telegram/downloaded copies. Unknown remote outcomes may require operator investigation.
- **Validation:** no retention, willingness-to-pay, market-fit or speed improvement has been measured. Follow [the consent-based pilot](PILOT.md); do not count rehearsed second-session work as voluntary return.

Animated stickers, iMessage export, Snapchat composition, marketplace, social feed, payments, team editing and proprietary model training are intentionally deferred.

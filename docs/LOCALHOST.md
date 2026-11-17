# Test Bias Studio on localhost

Beta 1.3.0 is available in [PR #6](https://github.com/toreleon/bias-studio/pull/6). Public deployment is deferred while localhost testing proceeds.

## Workspace setup

The localhost verification session used these addresses and private files:

- App: http://localhost:8081
- Backend: http://localhost:8787
- Demo pack: http://localhost:8787/p/3185e0000cfdc331d36f38ef013507ce5ae8
- Private database: `/workspace/work/bias-studio/server/data/local-beta.sqlite`
- Test invitation: `/workspace/work/bias-studio/server/data/operator/local-creator.invite`. Read its `code` privately; keep the invitation out of Git and chat.
- AI has server configuration, but the automated localhost check made no model requests. The session used a daily limit of three requests per creator and three across the backend. OpenAI is called only after confirming generation in the app. Replace the key previously shared in chat before using live generation.
- Telegram is disabled until a bot is configured. WhatsApp actions require the native app and its bridge.

These addresses refer to **the workspace's localhost**, rather than your own computer. Server availability depends on the workspace session. The verification session did not provide Desktop opening or port-forwarding tools, so UI checks used automated Chromium. Open `screenshots.html` in the handoff package to view the captures, or run the app on your computer using the steps below.

## Run on your computer

Use Node 22.16 or later (Node 24 recommended), npm and a checkout of the repository. These commands work in Bash on macOS, Linux or Git Bash.

```bash
git fetch origin
git switch feat/fandom-beta
npm ci
test -f server/.env.local || cp server/.env.example server/.env.local
chmod 600 server/.env.local
```

Preserve any existing private configuration. To test live AI, use an editor to put a new OpenAI key in `server/.env.local`. Keep it out of `EXPO_PUBLIC_*` variables. Leave the key empty to test photos, video frames, the library, local links and ZIP files without generation.

Terminal 1:

```bash
BETA_HOST=127.0.0.1 BETA_PORT=8787 \
BETA_DB=./server/data/local-beta.sqlite \
BETA_PUBLIC_URL=http://localhost:8787 \
BETA_WEB_ORIGIN=http://localhost:8081 \
BETA_DAILY_LIMIT=3 BETA_CREATOR_DAILY_LIMIT=3 \
npm run beta:serve
```

In Terminal 2, create a private invitation if one does not already exist:

```bash
mkdir -p server/data/operator
BETA_DB=./server/data/local-beta.sqlite npm run beta:invite -- \
  --label "Local Creator" \
  --output server/data/operator/local-creator.invite --quota 3
EXPO_PUBLIC_BETA_URL=http://localhost:8787 npm run web
```

The invitation is written to the specified private file. Open that file and enter its `code` in the app's **Creator invite** field. The command refuses to overwrite an existing invitation file. Open http://localhost:8081.

## Test workflow

1. Choose **Try a 3-reaction demo**, or import your own photos/video. Style the pack, edit captions, and save reactions and a style to Library.
2. Reload or close and reopen the app. Confirm the pack is still there. Use Library to create a second pack and edit one reaction; the first pack should remain unchanged.
3. Open Preview and enter a pack name and creator credit. **Download pack file** creates a ZIP containing finished stickers. Editable-source sharing is a separate action with a disclosure of the included data.
4. Connect the creator account using the invitation, choose publish and read the confirmation. The link works on your localhost. Open it in an incognito window, download the ZIP and import it into the app. Unpublish the collection and reload its link; new access should fail.
5. Stop the backend with Ctrl+C, then run the Terminal 1 command again. The invitation, ownership and pack should persist. Unpublishing cannot recall ZIP files already downloaded.

Localhost checks do not establish Telegram or WhatsApp installation. Telegram webhooks require HTTPS reachable by Telegram. A physical phone also cannot reach your computer through its own localhost address. Native add-and-send validation is a separate step.

## Recorded results

- All 105 automated tests passed, together with all five CI jobs, including Android and iOS Simulator builds.
- The actual UI → HTTP backend → anonymous recipient → finished ZIP → import workflow passed.
- Creating a second pack from the library preserved the first pack.
- Restarting the backend preserved the invitation, ownership and pack. Unpublish returned 404; publishing the reviewed revision again succeeded.
- The localhost check made no AI requests and incurred no generation charges.

The handoff package contains machine-readable results in `localhost-verification.json`, `local-verification.json` and `ci-results.json`, alongside source, builds and screenshots. The CI iOS artifact is an unsigned Simulator build; it requires macOS Simulator. Physical iPhone installation requires a separately signed device build.

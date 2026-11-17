# GPT Image pilot service

The app supports real prompt-to-image and reference-image generation through a small server adapter. The provider key never belongs in Expo configuration, JavaScript bundles or GitHub source. The default model is `gpt-image-1.5`, explicitly supported by the [current Images API](https://developers.openai.com/api/reference/resources/images/methods/generate.md). Model choice is server-side. Reference requests use the [JSON image edit contract](https://developers.openai.com/api/reference/resources/images/methods/edit.md).

## Start locally

Use Node 22 or newer. Copy `server/.env.example` to `server/.env.local`, restrict its permissions (`chmod 600 server/.env.local`), and set `OPENAI_API_KEY` on that server. Set `GENERATION_ACCESS_TOKEN` to a random value of at least 24 characters. A password manager or `openssl rand -hex 32` can generate it. Give that separate code only to the controlled pilot participants. Never use the provider key as the access code.

```sh
npm run generation:serve
```

In another terminal:

```sh
EXPO_PUBLIC_GENERATION_URL=http://localhost:8787 npm run web
```

Open **Create with AI**, describe a subject, optionally add one reference, choose a look and reactions, then Generate. Enter the studio access code in the confirmation sheet. The code lives only in this screen session. No automatic upload occurs when picking a reference or saving a recipe.

For an environment requiring an outbound proxy, preserve its proxy and CA variables. With Node 24, `NODE_USE_ENV_PROXY=1 npm run generation:serve` enables the built-in proxy support. A direct fetch can fail even if curl works. Do not disable TLS verification.

## Phone builds and deployment

A phone needs a reachable **HTTPS** service URL supplied as `EXPO_PUBLIC_GENERATION_URL` before bundling. `localhost` on a phone is the phone itself. The development HTTP exception is for browser localhost only; this work does not change native cleartext policies.

Deploy `server/generation.mjs` as a long-running Node service behind TLS, configure its key/code through the host's secret management, and set an exact browser origin if web access is desired. `GENERATION_HOST` defaults to loopback; a host may require `0.0.0.0`. Preserve Authorization and allow requests to run for up to 150 seconds. The service exposes only `POST /v1/stickers`, with bearer authentication and JSON content. It accepts a prompt and optional embedded image, and returns one PNG data URL plus the model name.

The repository does not contain a deployed public endpoint, production accounts or a durable job service. Test APKs built without a URL let users save recipes and import external results; they explicitly say generation is not connected. A working localhost browser test does not establish working generation on a physical phone.

## Limits and failure behavior

- One provider image per request; 1024-square transparent PNG requested at low quality, normalized to a 512px editable source on the client. Browser sources use transparent WebP at 0.92 quality to keep reusable copies within storage limits; native sources use PNG files. Reference images are also bounded before saving.
- Requests limited to 8 MiB; reference must be embedded PNG/JPEG/WebP. Remote image URLs are rejected, avoiding server-side arbitrary URL fetching.
- Up to two concurrent calls and a default 24 attempted calls per UTC day **per process**. Set `GENERATION_DAILY_LIMIT` lower for a pilot. Attempts may be charged even if cancelled or timed out.
- Quotas reset on server restart; they are a pilot guard, not a durable billing limit. Use provider project budgets as an additional control. Production needs per-user persistent quotas and abuse controls.
- The server does not log prompts, images, authorization values or raw provider errors, and stores no generated content on disk. Hosting/proxy logs and provider retention policies remain separate.
- The client saves each completed result before requesting the next one. A failure stops the queue; retries are explicit. Closing the screen aborts the current request locally and never promises that provider billing stopped. OS suspension may interrupt a request; completed results remain available.
- API responses may be imperfect despite a requested transparent background. Inspect edges, likeness and chat-size legibility. No face identity lock or animation support is claimed.

Before a public launch, replace the shared pilot access code with real account authentication, durable quota/idempotency/job management, and a reviewed privacy/retention policy. Keep original unpublished libraries private. Public collection hosting is separate from generation hosting.

## Verification

`npm run check` includes provider-adapter and server HTTP tests. `npm run test:e2e` uses explicitly intercepted test responses, never a real key or paid request. Those tests cover partial failure, retry, cancel, imports, captions, recipe reuse and reopening. Live-provider observations are reported separately in `docs/VERIFICATION.md`; screenshot labels distinguish actual generated content from test fixtures.

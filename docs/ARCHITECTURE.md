# Creator workspace and beta service architecture

The app is an Expo SDK 54 / React Native local workspace with a supporting Node service. Expo Router owns `src/app/` routes: Home, Library, Packs, Create `[id]`, Pack `[id]`, Edit `[id]?item=…`, Preview `[id]` and Receive `[id]`. The shared workspace provider handles local state; screens and services live outside route files. Generated native projects remain disposable/untracked.

The service implements authenticated generation, finished-pack publishing and Telegram export. It is **not a deployed endpoint or editable-library sync service**. Use [BETA-DEPLOYMENT.md](BETA-DEPLOYMENT.md) for operations and [BETA-VERIFICATION.md](BETA-VERIFICATION.md) for actual evidence. The original [audit](research/product-audit.md) describes its stated baseline commit, not the subsequently added beta code.

## Local data and migration

`workspace.ts` retains schema version 2:

- `collections`: identity, optional name/creator credit, ordered editable reactions, timestamps and optional import-origin credit.
- `assets`: independent saved reaction snapshots. Reuse/duplication deep-copies editable fields and assigns new identities, so changing a second pack does not rewrite the first.
- `styles`: named style-only presets, excluding source/crop/caption content.
- Optional `creations`: recipes, reference/look/reaction choices, candidates, sample approval, saved-recipe state and durable request records. Older v2 data without creation fields remains valid.

Designs retain source/cutout images, crop, caption/style and ordered erase/restore strokes. Reactions can also retain source filenames, frame timestamps, optional tags and generation provenance. These authoring fields are private unless the user deliberately shares an editable archive.

`workspace-storage.ts` loads `bias-studio.workspace.v2`, otherwise validates/migrates `bias-studio.library.v1`. The original v1 key is never modified or deleted. Migration preserves old collection pixels as flattened designs. Repeated legacy sticker identities are deduplicated in the asset library when identical; differing versions receive unique library IDs while packs remain intact. It does not invent missing original photos or editable baked captions. Invalid/corrupt data fails closed rather than replacing existing work with an empty workspace.

Edits update memory immediately and autosave after a debounce. Serialized writes prevent an older slow save replacing a later revision. Saved status appears only after persistence completes; errors preserve memory and offer retry. Export flushes first, native backgrounding flushes, and web unload warns of unsaved changes. OS termination during an outstanding write can still lose that interval. Undo retains 20 session snapshots and persists the restored state.

Native selected photos/frames/cutouts live in app document storage. Browser sources are compacted to bounded WebP data URLs (up to 128 KiB encoded string per compacted source), then persisted through AsyncStorage/localStorage. This reduces quota pressure but does not provide unlimited storage or IndexedDB-backed media. Original videos and uncommitted selection state are temporary; added frames/timestamps persist. Native container relocation and safe orphan cleanup remain device/retention concerns.

## Rendering and local transfers

`scene.ts` composes a shared 512px SVG. Captions have independent fill/outline/placement; system font rendering can vary by platform. Unique SVG mask IDs prevent collisions in grids. Manual erase/restore strokes use canvas coordinates, so crop first before refining an edge.

Web export rasterizes SVG through canvas; native export captures a mounted transparent SVG after drawing. Both compress final WebP to the destination envelope. Rendering uses an immutable collection snapshot and progress; intermediate files are disposed after sharing/handoff or failure. Actual edge/transparency quality needs device evidence.

`portable.ts` has two explicit formats:

| Format | Contents and import behavior |
| --- | --- |
| `bias-studio-finished` v1 | Allowlisted name/identity/credit plus rendered `stickers/NN.webp`. Import creates fresh local identities and flattened reactions; source layers/prompts/tags are absent. |
| `bias-studio` v1 editable archive | Full collection with embedded source/cutout image data and editable metadata, plus rendered stickers. Explicitly chosen backup/authoring transfer. |

Archive import validates expected manifests, embedded image types, sizes and known paths rather than extracting arbitrary files. Existing data is not replaced on failure. Editable files have a 32 MiB compressed/60 MiB metadata limit. Local finished files can contain 1–30 stickers; online publishing uses the shared 3–30 static-sticker envelope. Download/share/import is not destination installation.

`exports.ts` separates rendering from destination handoff. WhatsApp uses the native Android provider/intent and iOS expiring local pasteboard. The provider exposes validated immutable export snapshots, not source media. A successful return means the destination opened; installation/send needs confirmation outside this callback. Changed content can produce new destination revisions. Native snapshots remain for provider reads and must not be deleted casually during cleanup.

## Server boundary and identity

`server/beta-server.mjs` is the current entry point; `npm run beta:serve` starts it. `server/generation.mjs` supplies the OpenAI adapter and also retains a legacy standalone `/v1/stickers` harness, which is not the current app backend.

`beta-store.mjs` uses private SQLite with WAL, foreign keys, busy timeout and immediate transactions. Creator invites and session tokens are random secrets represented by hashes in the database. An invite exchanges for a seven-day session; owner checks scope jobs and cloud packs. Invite revocation disables further exchanges and existing sessions. The client (`src/beta/client.ts`) holds its bearer session in memory only; Disconnect clears that local session, and reconnection is needed after restart. The current system is operator-invited access, not a general self-service identity provider.

Run **one beta service/generation worker per database** on a persistent private volume. This implementation does not supply distributed worker leases or multi-replica scheduling. HTTPS termination and exact permitted browser origin are deployment requirements; localhost HTTP is allowed for development. The service sets no-store and restrictive response headers, limits body size and sign-in attempts, and avoids echoing unknown exceptions or upstream payloads. These measures do not replace host monitoring, abuse handling, backups or privacy review.

| Route family | Boundary |
| --- | --- |
| `GET /health`, `GET /v1/config` | Health/capability metadata; no provider secret |
| `POST /v1/session`, authenticated `DELETE /v1/session` | Invite exchange and server session revocation |
| `/v1/jobs`, `/v1/jobs/:id`, `/cancel`, `/kept`, `/v1/usage` | Owner-only generation admission, recovery, state and estimate reporting |
| `/v1/packs`, `/v1/packs/:id/{publish,unpublish,telegram}` | Owner-only cloud render snapshot management and destination creation |
| `/p/:id`, `/public/packs/:id`, `/images/:index`, `/download` | Anonymous access only while that collection is published |
| `/v1/telegram/link`, `/v1/telegram/webhook` | Authenticated link initiation/status; secret-verified bot updates |

## Durable generation

`beta-generation.mjs` reserves an attempt and configured micro-USD estimate transactionally before inserting a queued job. `(creator_id, request_id)` is unique; replay returns the original job, while changed content with the same ID is rejected. UTC-day creator/global attempt caps and a global reservation ceiling survive restarts.

One worker processes up to two requests at once. Queued requests can resume after restart. Previously running requests become `interrupted`, because the provider may already have charged them. Terminal states include succeeded, failed, canceled and interrupted. A transport failure/timeout is not proof of zero billing. Client disconnect/pause does not terminate the server job; cancellation is explicit and does not promise a refund. No uncertain attempt is automatically sent again.

`src/creation/model.ts` validates local creation/request data and constructs reaction prompts. `CreateScreen` persists an immutable attempt before submitting through `creation/client.ts`, polls owner-only status and saves each result before continuing. Sample approval gates larger creation; the optional approved reference is a consistency aid, not an identity guarantee. Captions are rendered independently. Saved recipes start new work; accepted candidates produce independent pack/library reactions with provenance.

The beta entry point selects `gpt-image-2.6-sunburst` unless `GENERATION_MODEL` overrides it. It uses the existing Images generation/edit adapter with an embedded optional reference, one low-quality transparent 1024-square PNG request, and numeric usage retained when supplied. References and generated sources are normalized client-side. The legacy harness/helper defaults are not the beta model-selection authority. Compatibility/quality must be checked against the live model, separately from mocked tests.

Inputs are retained privately while queued/running and cleared when terminal; successful result bytes remain for authorized recovery until operator pruning. Reservations include failed/canceled/uncertain attempts. `kept` is a per-job boolean, making repeated marking idempotent; the usage API reports configured estimate per kept result, **not actual cost**. The client marks generated candidates kept when put in a pack, not when a recipient uses them. Provider billing reconciliation and cohort attribution remain operational work defined in [PILOT.md](PILOT.md).

## Finished publication and Telegram

`beta-distribution.mjs` accepts only the final-render/credit representation and validates actual WebP envelope/frame dimensions, 512px size, byte ceiling and static format. Unknown image metadata chunks such as EXIF/XMP are rejected. Editable design objects, source references and private fields are not part of the upload contract. Render bytes and revision metadata are stored in private SQLite for this small beta, rather than a separately provisioned object store.

A save is owner-scoped and initially private; a persistent per-owner local collection ID maps retries back to the existing cloud copy. Changed content increments the revision and makes the cloud page private. Identical retries preserve the revision/public state. Publish and Telegram export require the reviewed revision; stale confirmation is rejected instead of publishing a changed collection. Anonymous page, image and download handlers check publication on each request and use no-store responses. The HTML page includes collection credit, the creator account label disclosed at publication confirmation, previews, finished download and native receiving link; Telegram appears only for a verified set. `/receive/[id]` retrieves the finished archive into a fresh local pack, then lets the user perform the supported native WhatsApp handoff. It is not browser installation.

Telegram linking stores a short-lived single-use nonce and derives the Telegram identity from a secret-verified private bot update, not an arbitrary client-supplied user ID. `server/telegram.mjs` checks bot identity, creates the user-owned set from finished media and verifies the returned set. A persisted revision/set mapping supports reconciliation after uncertain calls; a verified set returns a `t.me/addstickers/...` link. This real adapter's automated integration uses mocks; live bot/account and recipient checks remain required.

Unpublishing removes public Bias access but leaves already downloaded copies and Telegram distribution independent. It is not remote deletion of a recipient's library. Public creator credit must be deliberately selected. The disclosed account label is public on the collection page; choose a suitable pseudonym. Internal account IDs, authentication secrets and private library fields are not public analytics identifiers.

## Administration, evidence and release

`beta-admin.mjs` creates private invite files, uses SQLite's online backup API, revokes accounts' invite/session access, and logically prunes old terminal job payloads while preserving idempotency/usage records. The explicit prune cutoff must be at least 30 days old. Pruning does not physically erase old WAL/database pages or backups; physical reclamation and encrypted-backup retention are operator procedures. Published packs are not generation payloads and are unaffected by this pruning.

[GENERATION-SETUP.md](GENERATION-SETUP.md) documents configuration and recovery. [BETA-DEPLOYMENT.md](BETA-DEPLOYMENT.md) owns the activation/operations checklist. [BETA-VERIFICATION.md](BETA-VERIFICATION.md) distinguishes current automated results, screenshots, available builds and blocked live/device checks. Earlier [VERIFICATION.md](VERIFICATION.md) records historical 1.2 evidence; it does not certify this model or service.

[RELEASING.md](RELEASING.md) and the existing CI/release policy remain the release authority. Preserve protected main, aggregate checks, exact successful artifact provenance, human environment approval and physical-device signoff. No deployment, signed store release or recipient success is implied by this architecture description.

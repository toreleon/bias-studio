# Bias Studio product and release audit

Audit date: 2026-11-17. Baseline: `d9bfdecf122be00bc597b8abb29ba34bfb80013f`, branch `feat/creator-workspace`, app/package version 1.2.0. This is an independent static inspection plus read-only GitHub API verification. No provider calls, deployments, releases, secret reads, or code changes were performed for this audit. Line references describe this baseline; implementation work can subsequently change them.

## Assessment

The repository contains a substantial working local creator workspace, not yet a distributable creator-to-recipient beta. Batch editing, reusable reactions/styles, explicit editable archives, migration protection, and browser acceptance coverage are present. WhatsApp has genuine native implementations, but their successful compilation is not proof of installation on a real phone. Telegram installation, public collection pages, and durable generation accounts/jobs are missing at the audited baseline.

## Independently verified repository state

- [PR #5](https://github.com/toreleon/bias-studio/pull/5) is open with `REVIEW_REQUIRED`; its head matches the audited commit.
- [CI run 44048777879](https://github.com/toreleon/bias-studio/actions/runs/44048777879) completed successfully: Quality, Browser and web build, Android native build, iOS native build, and CI gate. GitHub lists unexpired artifacts `web-preview-1`, `browser-test-results-1`, `ios-simulator-1`, and `android-test-1`. Artifact binaries were not independently installed or inspected in this audit.
- Main is protected and points to `5df562c0e418114801633d3d7d30543f1b138c9d`, not the PR head. Detailed branch-protection retrieval returns HTTP 403; specific currently enforced required checks/review settings cannot be independently confirmed with this integration.
- The `release` environment has a required reviewer, allows release self-review, and its only deployment branch policy is `main`. This matches the documented solo-maintainer configuration, not separation of duties.
- GitHub deployments API returned an empty list. No hosting manifest/public endpoint is present among tracked deployment/service files. This does not prove that no independently managed deployment exists; no working remote deployment was evidenced by this audit. `docs/GENERATION-SETUP.md:23–29` explicitly documents the lack of a deployed endpoint.

## P0 blockers for the requested market-testing beta

### 1. There is no complete recipient distribution path

Evidence: `src/screens/PreviewScreen.tsx:31–56` only handles WhatsApp and editable pack files. Its sharing UI (`193–218`) requires another creator to import a ZIP. `server/generation.mjs:139–142` exposes only POST `/v1/stickers`. No Telegram or public collection route exists in the baseline.

Impact: A recipient with only WhatsApp/Telegram cannot follow a collection link, preview the pack, or install a Telegram set. The product cannot measure creator-to-recipient adoption, regardless of creator-side quality.

Focused fix: Introduce an explicit publish operation producing an immutable finished-sticker snapshot, creator attribution, an unguessable collection identifier, HTTPS previews, and real destination actions. Telegram needs a server-side Bot API implementation and a successful sticker-set result before displaying `t.me/addstickers/...`. Keep WhatsApp actions honest about needing the native app and destination confirmation. Prepare hosting and secret configuration for review before any external publication.

### 2. Generation admission and cost limits are neither per-user nor durable

Evidence: `server/generation.mjs:99–108,130–139` authenticates one shared token. `105–107,169–183` stores daily usage and concurrency only in process variables. There is no job identifier or idempotency key in `src/creation/client.ts:17–24`; server results exist only in the response (`179–185`). The client explicitly warns a timeout retry may incur another charge (`client.ts:32`).

Impact: Restarts reset limits; multiple replicas each admit their own allowance. One participant can exhaust everyone's quota. A lost response or suspended phone can lose a paid result and require another paid request. These are concrete architecture limitations, not merely missing UI.

Focused fix: Authenticated creator identities, durable atomic usage reservations, bounded per-user/global budgets, one job per idempotency key, authorized status/result lookup, and explicit retry semantics. A disconnected request must not silently start another generation. Persist the minimum necessary job/output data with owner isolation and retention rules. Reconcile ambiguous provider outcomes rather than claiming a cancellation guarantees no charge.

### 3. The only shareable archive includes editable sources and descriptions

Evidence: `src/portable.ts:25–41` clones the complete collection, embeds both `design.source` and `originalSource`, and serializes all metadata. `PreviewScreen.tsx:209–218` does warn about original photos, cutouts, captions, tags, timestamps, and AI descriptions, so this is not an undisclosed leak. However there is no finished-only collection format or public projection.

Impact: Ordinary recipient sharing requires unnecessarily granting editable assets and prompts, or abandoning sharing. Reusing this payload directly for future public pages would expose unpublished source data.

Focused fix: Make finished sharing a separate allowlisted representation containing rendered sticker bytes, public title/creator credit, and destination metadata only. Keep editable archive sharing an explicitly separate opt-in action. Test the serialized bytes and public HTTP responses for absence of original sources, reference images, prompts, private tags, and local file paths.

### 4. WhatsApp installation remains an unverified release requirement

Evidence: Android `FanStickersModule.kt:94–100` starts an intent and returns true; iOS `FanStickersModule.swift:65–70` returns the URL-opening result. `src/exports.ts:32` correctly calls this a handoff, and `PreviewScreen.tsx:45–47` asks the user to confirm Add in WhatsApp. `tests/workspace.test.ts:154–182` tests a fake destination function; it never invokes WhatsApp. CI compiles Android and iOS Simulator (`.github/workflows/ci.yml:105–116,141–152`) but runs no physical WhatsApp installation test.

Impact: Neither successful CI nor an opened URL demonstrates that WhatsApp accepted the files, that rendering retained transparency, or that users can recover from app absence/rejection/cancellation. Current false handoff result becomes only “Install WhatsApp” (`media.native.ts:203`), without platform-specific recovery.

Focused fix: Preserve handoff semantics, add typed availability/handoff/rejection errors where the platform exposes them, actionable retry guidance, and record real Android/iPhone evidence. Do not label a cancellation or generic share sheet as installed. Gate candidate release on the existing device requirement.

## Native implementation inspection

Android has meaningful safeguards: exact image size/MIME/byte checks (`FanStickersModule.kt:114–120`), app-local file checks (`104–111`), staging and atomic rename (`70–93`), and immutable revision IDs passed from JS (`media.native.ts:196–201`). The provider exposes only metadata and allowlisted snapshot files (`StickerProvider.kt:19–22,49–59`), protected by `com.whatsapp.sticker.READ` (`AndroidManifest.xml:8–13`). It does not expose original photos through that provider. Queries include normal WhatsApp and Business packages. The launch intent is implicit; explicitly constrain supported recipients or safely handle resolution/launch errors during the fix.

iOS has genuine Vision segmentation and WebP decoding dependencies. Its export verifies PNG/WebP dimensions and byte limits (`FanStickersModule.swift:83–94`), checks app-local URLs (`76–81`), and transfers only final image bytes via a local-only pasteboard expiring after 60 seconds (`56–69`). `app.json:19–21` declares the WhatsApp URL scheme. No specific protocol incompatibility was established by static inspection. WhatsApp Business behavior, pasteboard permission behavior, delayed foreground handoff, actual transparency, and destination rejection remain physical-device tests.

Neither native implementation handles animated output; the UI correctly describes still stickers. Preserve this boundary until a destination-specific animated pipeline actually exists.

## Reliability and migration follow-ups

- **P1: Browser library capacity is structurally fragile.** `media.web.ts:58–70` retains imported photos as up-to-1200px PNG data URLs. `workspace-storage.ts:32` serializes the entire workspace into AsyncStorage (localStorage on web), while saving library assets copies designs (`PackScreen.tsx:135–142`) and reuse copies them again. A normal photo-heavy collection can exhaust browser storage well before the 30-item pack limit; compact generated images do not solve regular photo imports. Quota errors preserve in-memory edits and offer retry, but retry cannot fit the same data into an unchanged capacity. Use blob storage/IndexedDB with stable media references for web, bounded image imports, and a meaningful recovery/export option. Test real detailed images rather than only tiny fixtures.
- **P1: Intermediate video choices are not resumable.** Pending video, selected frames, and candidate frames live only in React state (`PackScreen.tsx:49–52,102–105`); only Add selected moments writes them to a collection (`148–162`). Closing during selection loses that selection even though the surrounding draft can be saved. Persist selected frame state or label clearly when those moments have not yet been added.
- **P1: Legacy migration rejects some structures the old validator accepted.** `domain.ts:122–151` imposes no uniqueness on sticker IDs; `workspace.ts:181,195` preserves IDs and flattens all reactions into the asset library, whereas v2 validation requires unique asset IDs (`305–307`). A v1 sticker reused across two packs therefore creates duplicate asset IDs and `loadWorkspace` cannot save the migrated workspace (`workspace-storage.ts:21–23,27–30`). Deduplicate library assets while preserving each pack, and add a legacy repeated-ID fixture. Preserve the original v1 key regardless.
- **P1: Native source URIs are absolute container paths.** `media.native.ts:86–91` stores absolute document URIs in designs. Validate app-upgrade/restore behavior on iOS, where container relocation can invalidate persisted absolute paths; use relative app-document references or rebase known source paths when loading. This is a risk requiring device reproduction, not an observed failure in this audit.
- **P2: Export snapshot/source files have no reachability cleanup.** Android creates a new immutable snapshot for each edited revision, while removed/cancelled assets also leave document files. Retain files needed by installed packs and undo; add measured cleanup only with a safe reachability policy. Avoid deleting active WhatsApp snapshots to save space.

Existing persistence is thoughtfully defensive: queued writes are serialized (`save-queue.ts`), saves are debounced and flushed on background transitions (`WorkspaceProvider.tsx:73–119`), malformed data fails closed, and the old v1 key is never deleted (`workspace-storage.ts:9–24`). Existing acceptance coverage actually exercises importing, styling, saving, reloading, and a second pack from reused reactions/styles (`tests/e2e/studio.spec.ts:62–123`). Preserve that baseline.

## What is proven, implemented, and not proven

| Capability | Evidence level at baseline |
| --- | --- |
| Local import, frame extraction, batch styles, manual corrections, library reuse, reopening | Implemented; green browser workflow tests, with native APIs compiling |
| Legacy migration and corrupted-data recovery | Implemented and tested for supplied fixtures; edge case above remains |
| Editable ZIP sharing/import | Implemented; browser tests inspect real WebP output; original-sharing warning present |
| OpenAI generation/edit adapter | Implemented real HTTP adapter; service/unit tests inject responses; AI browser tests intercept fixture responses (`tests/e2e/creation.spec.ts:42–51`) |
| Live model quality/identity consistency | Not independently tested in this audit; no claim inferred from mocked CI |
| WhatsApp Android/iOS | Native code compiles; actual installation unverified here |
| Public preview and Telegram set creation | Absent at baseline |
| Authenticated durable generation jobs/quotas | Absent at baseline |
| Remote deployment or signed iPhone build | Not evidenced; iOS artifact is an unsigned Simulator app, not an installable iPhone IPA |

## Release gate preservation

Keep the aggregate CI gate requiring every job (`ci.yml:160–171`), pinned actions, exact source manifests/checksums, and separate release environment. `scripts/release-policy.mjs:14–29,33–47,51–89` checks current protected main, version/tag match, physical-device attestation, exact latest successful main-push CI, human approval policy, and unexpired artifacts. `release.yml:75–89` downloads that exact run, verifies artifacts, rechecks eligibility after approval, and creates only a draft prerelease. The artifact types are test Android APK and iOS Simulator ZIP, not store-ready releases. `eas.json` does not configure a public API URL.

The smoke checkbox is a human assertion, not automated evidence. Attach a small device evidence record (commit, OS/app versions, observed installation/send/reopen behavior, tester, date) when it is checked. Do not weaken gates merely to deliver a beta quickly.

## Focused verification plan

1. Re-run the existing creator acceptance scenario on native devices and the browser using real photos and a video: create 6–12 reactions, batch style, override one, correct cutout, save, terminate/reopen, reuse assets/styles for a second pack, and verify timestamps and independent edits.
2. Exercise finished-only vs editable exports byte-for-byte. Public response/ZIP must contain no originals, prompts, private tags, or local URIs; editable archive must retain them only after explicit consent. A private draft must have no public URL until publish succeeds.
3. Test recipient pages without a creator account, missing/deleted/private collections, poor network, mobile viewport, attribution, and only actually available destination actions. Verify a real Telegram set can be opened and installed, retry after ambiguous provider completion does not create duplicate sets, and invalid assets fail recoverably.
4. Test generation quota admission across two concurrent server processes, restart, same idempotency key, different authenticated users, exhausted global/user budget, cancelled client, server timeout, and lost response. Results must remain owner-only and reusable without a second provider charge for a repeated completed job. Use injected providers in CI; separately approve bounded live calls.
5. On Android and iPhone test 3/30 stickers, missing WhatsApp, Business where supported, cancel Add, edited re-export, transparent complex images, and app restart after handoff. Confirm a sticker can actually be sent to a chat. Record failures by platform instead of treating opening the destination as installation.
6. Add migration fixtures with a reused legacy sticker ID across packs, source paths from a prior iOS container, and a realistic near-quota browser library. Confirm recovery leaves old data intact.

External prerequisites still needing concrete setup/validation: HTTPS hosting and persistent storage, authenticating pilot creators, server secret configuration, Telegram bot authorization/ownership, signed iPhone distribution, physical WhatsApp devices/accounts, and approval before any actual publishing or significant paid traffic.

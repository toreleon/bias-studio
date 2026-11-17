# Revamp verification and device acceptance

Verification date: 17 November 2026. Scope: the creator-workspace revamp (app version 1.1.0). Refer to the PR's CI gate for results at its exact commit; an older main CI result does not validate these changes.

## Automated coverage

- 15 domain/workspace tests: pack constraints, immutable updates, schema validation, SVG escaping, v1 migration, selective batch styling, independent reuse, search, portable archive round trip/rejection, serialized persistence/retry, and failed/retried destination handoff.
- 10 Chromium end-to-end workflows: multi-photo creation; saved-style and reaction reuse after reload; multiple video frames/timestamps; individual overrides, erase/restore/undo/reorder; real ZIP/WebP export and reimport; migration preserving the v1 key; storage-full retry; export-failure retry; unreadable-data preservation; 390px mobile screenshots; and pixel-level verification that erase makes image pixels transparent and restore recovers the original pixels. The multi-part cases overlap these concerns.
- 8 unchanged release-policy tests: source/ref/version/protection/signoff requirements, correct latest CI proof, required approval/branch restrictions, artifact uniqueness/expiry and checksum/source integrity.
- Lint with zero warnings and TypeScript. Type checking explicitly excludes generated native/build/export trees.
- Production web export, Android Release ARM64 native compilation/release lint/signature checks, and iOS Release Simulator native compilation in the existing CI workflow.

The browser suite measures functional correctness. It does not measure creator retention or prove that the second pack is faster for real users. Screenshots use original demo art and are mobile browser captures.

## Native export review

Reviewed the existing native adapters against WhatsApp's official Android provider sample and iOS `StickerPack.swift` / `Interoperability.swift`. Retained the protected Android content provider, immutable revision snapshots, enable-pack intent, iOS local-only 60-second pasteboard payload, image encoding/dimension/size validation, and truthful handoff wording. Temporary rendering/tray files are cleaned on errors. Share-sheet archives are retained in cache because Android recipients can read them after the chooser returns.

Protocol review, automated adapter-failure tests and compilation **do not prove WhatsApp has installed a pack**. The receiving app controls confirmation. A live WhatsApp installation/send test on actual phones is still required.

## Physical-device checklist — remains required

No phone is attached to the development workspace. Linux cannot run iOS hardware tests. A physical iPhone build also needs Apple signing/provisioning. Do not mark the release workflow's device-smoke input true until a tester completes this checklist for the reviewed commit.

| Scenario | Required evidence |
| --- | --- |
| Multi-photo import | Select 3+ photos on Android/iPhone; verify order, orientation, bounded image size and readable thumbnails |
| Multi-frame import | Select 3 distinct moments plus an exact scrubbed frame; reopen and confirm pixels and timestamps |
| Native cutout/correction | Remove a clear person's background, erase/restore edges, undo; inspect light/dark chat preview and exported images |
| Durable editing | Close/relaunch after Saved, restart the phone, then edit originals/cutouts/captions; picker/cache cleanup must not break sources |
| Second-pack acceptance | Save/tag reactions and a style, reopen, then make a second pack from Library; verify editing it leaves the first unchanged |
| Native capture | Export all reactions, confirm 512px output, transparency, text/font choice, masks, image placement and tray icon |
| WhatsApp Android | Add a 3–30 sticker pack; confirm in WhatsApp; send each sticker; inspect images and creator credit |
| WhatsApp iPhone | Repeat with the local pasteboard handoff and actual WhatsApp confirmation |
| Failure/cancellation | WhatsApp absent, cancel installation, deny picker access, unreadable video, low storage; draft remains retryable and no installed-success claim appears |
| Local distribution | Share ZIP Android→iPhone and iPhone→Android; recipient imports, edits and adds to WhatsApp; test delayed receiver reads and cancelled share sheet |
| Accessibility | VoiceOver/TalkBack labels, text scaling, focus after dialogs, brush alternatives/undo, keyboard and small-screen layout |
| Limits | Packs of 2, 3 and 30; add beyond 30 rejected; complex oversized WebP fails recoverably; ZIP limits fail without overwriting existing data |

## Test builds and release boundary

GitHub CI uploads `android-test-<attempt>`, `ios-simulator-<attempt>` and `web-preview-<attempt>`, each with source/run/version/checksum evidence. Download the artifacts from the revamp PR's successful CI run. The Android APK is signed with the template debug key and intended for ARM64 test phones. The iOS ZIP contains an unsigned Simulator `.app`, not an iPhone IPA. Browser diagnostics and screenshots are in `browser-test-results-<attempt>`.

Local test output is also provided in the task's output directory. Follow [RELEASING.md](RELEASING.md) for a future candidate. This implementation does not bypass review, dispatch a release, sign a production build, publish public collection pages or submit to stores.

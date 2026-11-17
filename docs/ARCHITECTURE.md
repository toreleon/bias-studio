# Creator workspace architecture

Expo Router owns routes under `src/app/`: Home, Library, Packs, Pack `[id]`, Edit `[id]?item=…`, Preview `[id]`. `_layout` provides fonts, safe area and a shared workspace provider. Non-route UI lives in `src/screens` and shared controls. Generated native projects remain untracked.

## Data and migration

`workspace.ts` defines schema version 2:

- `collections`: identity, optional name and creator credit, ordered editable reactions, created/updated time and optional import-origin attribution.
- `assets`: saved reaction snapshots, independent of the pack after saving. Saving a reaction again replaces the snapshot with that reaction ID. Reuse/duplicate generates a new ID and deep-copies editable fields.
- `styles`: named style-only presets; no media/crop or caption content is included.
- A reaction includes its design, optional source filename/video timestamp, four optional tag values, and creation time. The design retains original and cutout sources, crop, caption/style, and ordered erase/restore strokes.

`workspace-storage.ts` reads `bias-studio.workspace.v2` first. If absent, it validates `bias-studio.library.v1` and migrates it once. The old key is never overwritten/deleted. v1 stickers have only rendered pixels, so migration keeps the original URI and collection identity and marks the design flattened. It does not invent a lost original photo or add the baked caption twice. Unknown/corrupt data blocks editing until it can be read, rather than replacing it with an empty workspace.

Edits update memory immediately, then autosave after 250 ms. The save queue serializes writes and does not allow an earlier slow write to replace a later revision. Status changes to Saved only after the write succeeds; failures preserve the in-memory draft and expose Retry. Export flushes persistence first. Native backgrounding triggers a flush; web unload warns if changes remain unsaved. An OS process kill during a pending write can still lose that unsaved interval. Undo retains 20 session snapshots and persists the restored state.

Native imported/resized photos, selected frames and cutouts are copied to document storage before they become draft references. Browser sources are bounded image data URLs in local storage. Original videos are not retained after the frame-selection session; selected frame images and timestamps are durable. Unreferenced native sources are conservatively retained; a future reachability-based cleanup must account for drafts, library snapshots and active undo history.

## Rendering and correction

`scene.ts` is the shared 512px SVG composition. Text uses a small portable font-family set (system glyph rendering can differ between platforms); captions have separate fill/outline and placement controls. Per-instance SVG identifiers prevent masks colliding across thumbnail grids. Manual strokes are ordered canvas-space erase/restore masks. Restore composites the original image through its own mask. Moving crop after brushing moves the image relative to those strokes, so the UI advises cropping first.

Web export rasterizes the SVG into a canvas; native export captures a mounted transparent SVG view after the drawing pass. Both progressively compress WebP and enforce WhatsApp's byte ceiling. Exports use an immutable draft snapshot and show per-sticker progress. Rendered intermediate files are disposed after sharing/handoff or failure. Runtime capture and edge quality still require physical-device checks; compilation alone is insufficient.

## Sharing and destinations

`exports.ts` defines a destination boundary accepting rendered `Pack` data. The WhatsApp adapter uses existing native validation, Android provider/intent and iOS expiring local pasteboard. A successful return means the destination opened, never that the user approved installation. Failure does not mutate the editable collection. The Android provider exposes only validated export snapshots, never source photos.

`portable.ts` encodes a ZIP with `collection.json`, `READ-ME.txt` and `stickers/NN.webp`. Sources in the JSON are self-contained PNG/JPEG/WebP data URLs. Native/web file adapters handle pick/share/download. Import limits compressed and expanded metadata size, validates the schema, rejects external/file image references, reads only the expected manifest (no arbitrary filesystem extraction), assigns fresh collection/reaction IDs and retains origin attribution. Native imports materialize embedded images into document storage.

This is an editable collection transfer format, not a WhatsApp install protocol or public-page service. Users explicitly choose to share source assets. Public collection infrastructure is outlined in [PRODUCT.md](PRODUCT.md).

## Failure and retention boundaries

Storage errors leave edits visible and retryable. Decoding/rendering or destination errors leave the draft intact. Invalid pack imports never replace existing data. Source files staged before a failed import can remain as unreachable private files; they are not published. WhatsApp snapshots are retained for its content-provider reads and may create new installed revisions after edits. Native share-sheet completion/cancellation is not a reliable delivery receipt.

`docs/RELEASING.md` and the existing CI/release policy remain the release authority. Public hosting, production signing, store submission and additional messaging destinations are separate work.

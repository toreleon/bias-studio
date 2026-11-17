import test from "node:test";
import assert from "node:assert/strict";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { decodeCollection, encodeFinishedCollection, toBase64 } from "../src/portable";
import { newCollection, reaction, validCollection } from "../src/workspace";
import { defaultDesign, Sticker } from "../src/domain";

// Minimal WebP header fixture exercises the archive boundary, not image decoding.
const webp = strToU8("RIFF1234WEBP");
const image = `data:image/webp;base64,${toBase64(webp)}`;
const sticker: Sticker = { id: "rendered", uri: "file:///rendered.webp", bytes: webp.length, width: 512, height: 512, caption: "secret editable caption", createdAt: 1 };
function fixture() {
  const pack = newCollection();
  pack.name = "Encore reactions";
  pack.publisher = "@creator";
  pack.items = [reaction({ ...defaultDesign("file:///private-source.jpg"), originalSource: "file:///original.jpg", caption: "private caption" }, { name: "private-video.mp4", seconds: 42 })];
  pack.items[0].tags.fandom = "private tag";
  return pack;
}
test("default finished sharing reads only rendered images and excludes original media and editable metadata", async () => {
  const pack = fixture();
  const reads: string[] = [];
  const bytes = await encodeFinishedCollection(pack, [sticker], async uri => { reads.push(uri); return image; });
  assert.deepEqual(reads, [sticker.uri]);
  const files = unzipSync(bytes);
  assert.deepEqual(Object.keys(files).sort(), ["READ-ME.txt", "collection.json", "stickers/01.webp"]);
  const manifest = JSON.parse(strFromU8(files["collection.json"]));
  assert.deepEqual(Object.keys(manifest).sort(), ["format", "version", "id", "name", "publisher", "stickers"].sort());
  assert.equal(manifest.publisher, pack.publisher);
  assert.deepEqual(manifest.stickers, [{ file: "stickers/01.webp" }]);
  assert.deepEqual(files["stickers/01.webp"], webp);
  const restored = decodeCollection(bytes);
  assert.ok(validCollection(restored));
  assert.equal(restored.items[0].design.flattened, true);
  assert.equal(restored.items[0].design.source, image);
  assert.equal(restored.items[0].design.caption, "");
  assert.equal(restored.items[0].design.originalSource, undefined);
  assert.equal(restored.items[0].source, undefined);
  assert.equal(restored.items[0].provenance, undefined);
  assert.notEqual(restored.id, pack.id);
  assert.notEqual(decodeCollection(bytes).items[0].id, restored.items[0].id);
  assert.deepEqual(restored.origin, { id: pack.id, creator: "@creator" });
});
test("finished sharing rejects absent, oversized and unrendered image data", async () => {
  await assert.rejects(encodeFinishedCollection(fixture(), [], async () => image), /1–30/);
  await assert.rejects(encodeFinishedCollection(fixture(), [sticker, sticker], async () => image), /could not be prepared/);
  await assert.rejects(encodeFinishedCollection(fixture(), [sticker], async () => "data:image/png;base64,YQ=="), /rendered WebP/);
  await assert.rejects(encodeFinishedCollection(fixture(), [sticker], async () => "data:image/webp;base64,YQ=="), /invalid/);
  const large = new Uint8Array(102401); large.set(webp);
  await assert.rejects(encodeFinishedCollection(fixture(), [sticker], async () => `data:image/webp;base64,${toBase64(large)}`), /100 KB/);
});
test("finished imports reject missing images, archive traversal and external image references", async () => {
  const bytes = await encodeFinishedCollection(fixture(), [sticker], async () => image);
  const files = unzipSync(bytes);
  const manifest = JSON.parse(strFromU8(files["collection.json"]));
  assert.throws(() => decodeCollection(zipSync({ "collection.json": files["collection.json"] })), /missing or invalid/);
  for (const file of ["../original.jpg", "https://example.com/tracker.webp", "stickers/02.webp"]) {
    manifest.stickers[0].file = file;
    assert.throws(() => decodeCollection(zipSync({ ...files, "collection.json": strToU8(JSON.stringify(manifest)) })), /not supported/);
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  addSticker,
  createPack,
  defaultDesign,
  isLibrary,
  LIMITS,
  packProblems,
  Sticker,
} from "../src/domain";
import { scene } from "../src/scene";
const sticker = (overrides: Partial<Sticker> = {}): Sticker => ({
  id: "sticker-1",
  uri: "file:///app/a.webp",
  bytes: 19000,
  width: 512,
  height: 512,
  caption: "my whole heart",
  createdAt: 1,
  ...overrides,
});
test("pack export accepts 3–30 stickers and rejects incomplete and oversized packs", () => {
  const pack = createPack("My bias");
  assert.match(packProblems(pack)[0], /3 more/);
  pack.stickers = [sticker(), sticker()];
  assert.match(packProblems(pack)[0], /1 more sticker to/);
  pack.stickers.push(sticker());
  assert.deepEqual(packProblems(pack), []);
  pack.stickers = Array.from({ length: 30 }, () => sticker());
  assert.deepEqual(packProblems(pack), []);
  assert.throws(() => addSticker(pack, sticker()), /full/);
  pack.stickers.push(sticker());
  assert.match(packProblems(pack)[0], /up to 30/);
});
test("export rejects invalid dimensions, corrupt size metadata and the 100KB boundary", () => {
  const pack = createPack("Frames");
  pack.stickers = [
    sticker(),
    sticker(),
    sticker({ bytes: LIMITS.stickerBytes }),
  ];
  assert.deepEqual(packProblems(pack), []);
  pack.stickers[2] = sticker({ bytes: LIMITS.stickerBytes + 1 });
  assert.match(packProblems(pack).join(), /100 KB/);
  pack.stickers[2] = sticker({ bytes: NaN, width: 1024 });
  assert.equal(packProblems(pack).length, 2);
});
test("pack creation trims valid names and rejects empty or very long names", () => {
  assert.equal(createPack("  Concert mood  ").name, "Concert mood");
  assert.throws(() => createPack(" "));
  assert.throws(() => createPack("a".repeat(65)));
});
test("adding a sticker is immutable and preserves pack identity", () => {
  const pack = createPack("Favorites");
  const next = addSticker(pack, sticker());
  assert.equal(pack.stickers.length, 0);
  assert.equal(next.stickers.length, 1);
  assert.equal(next.id, pack.id);
});
test("library loader rejects corrupted structures instead of overwriting them", () => {
  const pack = addSticker(createPack("Favorites"), sticker());
  assert.equal(isLibrary({ version: 1, packs: [pack] }), true);
  assert.equal(isLibrary({ version: 2, packs: [pack] }), false);
  assert.equal(
    isLibrary({ version: 1, packs: [{ ...pack, stickers: [{}] }] }),
    false,
  );
  assert.equal(
    isLibrary({ version: 1, packs: [{ ...pack, id: "../escape" }] }),
    false,
  );
  assert.equal(isLibrary({ version: 1, packs: null }), false);
});
test("sticker SVG escapes captions and sources and keeps the transparent canvas at 512px", () => {
  const xml = scene({
    ...defaultDesign("data:image/png;base64,abc"),
    caption: '<script>&"',
  });
  assert.ok(xml.includes('width="512" height="512"'));
  assert.ok(xml.includes("&lt;script&gt;&amp;&quot;"));
  assert.ok(!xml.includes("<script>"));
  const cutout = scene({ ...defaultDesign("file:///a.png"), shape: "cutout" });
  assert.ok(!cutout.includes("<g clip-path="));
  assert.ok(cutout.includes("xMidYMid meet"));
});

import test from "node:test";
import assert from "node:assert/strict";
import { createPack, isLibrary, Sticker } from "../src/domain";
import { migrate, validWorkspace } from "../src/workspace";

test("legacy reuse across packs deduplicates assets without dropping pack reactions", () => {
  const sticker: Sticker = {
    id: "reused-sticker",
    uri: "data:image/png;base64,aGVsbG8=",
    caption: "encore",
    bytes: 5,
    width: 512,
    height: 512,
    createdAt: 10,
  };
  const first = { ...createPack("First"), stickers: [sticker] };
  const second = { ...createPack("Second"), stickers: [{ ...sticker }] };
  const legacy = { version: 1, packs: [first, second] };
  const before = JSON.stringify(legacy);
  assert.ok(isLibrary(legacy));
  const migrated = migrate(legacy);
  assert.ok(validWorkspace(migrated));
  assert.equal(migrated.assets.length, 1);
  assert.deepEqual(migrated.collections.map((p) => p.items[0].id), [sticker.id, sticker.id]);
  assert.equal(JSON.stringify(legacy), before);
  const reopened = migrate(JSON.parse(JSON.stringify(migrated)));
  assert.ok(validWorkspace(reopened));
  assert.equal(JSON.stringify(reopened), JSON.stringify(migrated));
});

test("legacy ID collisions with different images retain every distinct asset", () => {
  const sticker: Sticker = {
    id: "reused-sticker",
    uri: "data:image/png;base64,aGVsbG8=",
    caption: "encore",
    bytes: 5,
    width: 512,
    height: 512,
    createdAt: 10,
  };
  const variants = [
    sticker,
    { ...sticker, uri: "data:image/png;base64,d29ybGQ=" },
    { ...sticker, id: "legacy-asset-1" },
  ];
  const legacy = {
    version: 1,
    packs: variants.map((s, i) => ({ ...createPack(`Pack ${i}`), stickers: [s] })),
  };
  const migrated = migrate(legacy);
  assert.ok(validWorkspace(migrated));
  assert.equal(migrated.assets.length, 3);
  assert.equal(new Set(migrated.assets.map((a) => a.id)).size, 3);
  assert.deepEqual(migrated.collections.map((p) => p.items[0].design.source), variants.map((s) => s.uri));
  assert.deepEqual(migrated.assets.map((a) => a.design.source), variants.map((s) => s.uri));
  assert.deepEqual(migrate(legacy), migrated);
});

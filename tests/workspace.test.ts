import test from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import { defaultDesign, createPack } from "../src/domain";
import {
  appendItems,
  applyStyle,
  duplicate,
  emptyWorkspace,
  matches,
  migrate,
  newCollection,
  reaction,
  styleOf,
  validWorkspace,
} from "../src/workspace";
import { decodeCollection, encodeCollection } from "../src/portable";
import { SaveQueue } from "../src/save-queue";
import { handoff } from "../src/exports";
const image = "data:image/png;base64,iVBORw0KGgo=";
const item = () =>
  reaction(
    { ...defaultDesign(image), originalSource: image, caption: "we won" },
    { name: "encore.mp4", seconds: 1.3 },
  );
test("v1 migration preserves collection identity, credit, original pixels and backup input", () => {
  const pack = createPack("Encore");
  pack.publisher = "@creator";
  pack.stickers = [
    {
      id: "original-1",
      uri: image,
      caption: "old caption",
      bytes: 99,
      width: 512,
      height: 512,
      createdAt: 4,
    },
  ];
  const old = { version: 1, packs: [pack] };
  const before = JSON.stringify(old);
  const next = migrate(old);
  assert.equal(next.collections[0].id, pack.id);
  assert.equal(next.collections[0].publisher, "@creator");
  assert.equal(next.assets[0].design.source, image);
  assert.equal(next.assets[0].design.flattened, true);
  assert.equal(next.assets[0].design.caption, "");
  assert.equal(JSON.stringify(old), before);
  assert.ok(validWorkspace(next));
  assert.deepEqual(migrate(next), next);
});
test("unknown, corrupt and malicious workspace shapes fail closed", () => {
  for (const value of [
    { version: 3 },
    null,
    { version: 2, collections: [], styles: [], assets: [{}] },
  ])
    assert.throws(() => migrate(value), /kept intact/);
  const w = emptyWorkspace();
  const r = item();
  w.assets = [r];
  assert.ok(validWorkspace(w));
  r.design.color = 'red" onload="alert(1)';
  assert.equal(validWorkspace(w), false);
});
test("batch styling only changes selected styles; captions, provenance, crops and other stickers survive", () => {
  const pack = appendItems(newCollection(), [item(), item()]);
  pack.items[0].design.x = 80;
  const before = JSON.stringify(pack);
  const next = applyStyle(pack, [pack.items[0].id], {
    ...styleOf(pack.items[0].design),
    font: "serif",
    outline: 24,
  });
  assert.equal(next.items[0].design.font, "serif");
  assert.equal(next.items[0].design.x, 80);
  assert.equal(next.items[0].source?.seconds, 1.3);
  assert.equal(next.items[0].design.caption, "we won");
  assert.deepEqual(next.items[1], pack.items[1]);
  assert.equal(JSON.stringify(pack), before);
});
test("reuse creates independent reactions and enforces the destination-sized pack limit", () => {
  const original = item();
  original.tags.fandom = "Aurora";
  const copy = duplicate(original);
  copy.design.caption = "encore";
  copy.tags.fandom = "Nova";
  assert.notEqual(copy.id, original.id);
  assert.equal(original.design.caption, "we won");
  assert.equal(original.tags.fandom, "Aurora");
  const pack = appendItems(newCollection(), Array.from({ length: 30 }, item));
  assert.throws(() => appendItems(pack, [copy]), /30 reactions/);
  assert.equal(pack.items.length, 30);
});
test("library search combines caption, tags and emotion filter", () => {
  const r = item();
  r.tags = { fandom: "Aurora", member: "Luna", era: "Encore", emotion: "hype" };
  assert.ok(matches(r, "aurora encore", "hype"));
  assert.ok(matches(r, "WE WON", ""));
  assert.equal(matches(r, "aurora", "love"), false);
});
test("portable collections round trip editable sources, masks, tags, timestamp and creator credit", async () => {
  const pack = appendItems(newCollection(), [item()]);
  pack.publisher = "@luna";
  pack.items[0].design.strokes = [
    { mode: "erase", radius: 10, points: [{ x: 20, y: 50 }] },
  ];
  const bytes = await encodeCollection(pack, [], async (uri) => uri);
  const restored = decodeCollection(bytes);
  assert.notEqual(restored.id, pack.id);
  assert.notEqual(restored.items[0].id, pack.items[0].id);
  assert.deepEqual(
    restored.items[0].design,
    JSON.parse(JSON.stringify(pack.items[0].design)),
  );
  assert.equal(restored.items[0].source?.seconds, 1.3);
  assert.deepEqual(restored.origin, { id: pack.id, creator: "@luna" });
});
test("portable import rejects external paths, invalid schema and unreadable files before touching storage", () => {
  const pack = appendItems(newCollection(), [item()]);
  pack.items[0].design.source = "file:///private/photo.png";
  const encode = (collection: any) =>
    zipSync({
      "collection.json": strToU8(
        JSON.stringify({ format: "bias-studio", version: 1, collection }),
      ),
    });
  assert.throws(() => decodeCollection(encode(pack)), /include its images/);
  assert.throws(
    () => decodeCollection(new Uint8Array([1, 2, 3])),
    /not a readable/,
  );
  pack.items[0].design.source = "https://example.com/track.png";
  assert.throws(() => decodeCollection(encode(pack)), /not supported/);
});
test("save queue prevents out-of-order writes and recovers after storage failure", async () => {
  const writes: number[] = [];
  let fail = true;
  const queue = new SaveQueue(async (w) => {
    await new Promise((r) => setTimeout(r, w.assets.length ? 1 : 15));
    if (fail) {
      fail = false;
      throw new Error("quota");
    }
    writes.push(w.assets.length);
  });
  const a = queue.save(emptyWorkspace());
  const b = queue.save({ ...emptyWorkspace(), assets: [item()] });
  await assert.rejects(a, /quota/);
  await b;
  await queue.save({ ...emptyWorkspace(), assets: [item(), item()] });
  assert.deepEqual(writes, [1, 2]);
});
test("failed WhatsApp handoff preserves editable collection and can be retried; success only means handoff", async () => {
  const pack = appendItems(newCollection(), [item(), item(), item()]);
  const before = JSON.stringify(pack);
  const stickers = pack.items.map((i) => ({
    id: i.id,
    uri: image,
    bytes: 123,
    width: 512,
    height: 512,
    caption: "hi",
    createdAt: 1,
  }));
  let attempts = 0;
  const destination = {
    id: "whatsapp",
    label: "WhatsApp",
    min: 3,
    max: 30,
    send: async () => {
      attempts++;
      if (attempts === 1) throw new Error("WhatsApp unavailable");
    },
  };
  await assert.rejects(handoff(pack, stickers, destination), /unavailable/);
  assert.equal(JSON.stringify(pack), before);
  assert.deepEqual(await handoff(pack, stickers, destination), {
    status: "handoff",
  });
  await assert.rejects(handoff(pack, [], destination), /3–30/);
});

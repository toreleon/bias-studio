import { strToU8, strFromU8, zipSync, unzipSync } from "fflate";
import {
  Collection,
  duplicate,
  newCollection,
  reaction,
  validCollection,
} from "./workspace";
import { defaultDesign, Sticker } from "./domain";

// Whitelist the public manifest: editable designs and provenance never enter it.
export type FinishedManifest = {
  format: "bias-studio-finished";
  version: 1;
  id: string;
  name: string;
  publisher: string;
  stickers: { file: string; emoji?: string }[];
};
function validWebP(bytes: Uint8Array) {
  return bytes.length >= 12 && bytes.length <= 100 * 1024 &&
    strFromU8(bytes.slice(0, 4)) === "RIFF" &&
    strFromU8(bytes.slice(8, 12)) === "WEBP";
}
export async function encodeFinishedCollection(
  collection: Collection,
  stickers: Sticker[],
  read: (uri: string) => Promise<string>,
) {
  if (!stickers.length || stickers.length > 30)
    throw new Error("Share a pack with 1–30 finished stickers.");
  if (stickers.length !== collection.items.length)
    throw new Error("Some stickers could not be prepared. Your draft is safe; try sharing again.");
  const manifest: FinishedManifest = {
    format: "bias-studio-finished", version: 1,
    id: collection.id, name: collection.name, publisher: collection.publisher,
    stickers: stickers.map((_, i) => ({ file: `stickers/${String(i + 1).padStart(2, "0")}.webp` })),
  };
  const files: Record<string, Uint8Array> = {
    "collection.json": strToU8(JSON.stringify(manifest)),
    "READ-ME.txt": strToU8("Finished stickers and creator credit only. Import this ZIP in Bias Studio, then choose Add to WhatsApp on a supported phone. A file download or share does not install a pack. Original photos, editable layers and AI prompts are not included."),
  };
  for (let i = 0; i < stickers.length; i++) {
    const data = await read(stickers[i].uri);
    if (!/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(data))
      throw new Error("A finished sticker must be a rendered WebP image.");
    const bytes = fromBase64(data.split(",")[1]);
    if (!validWebP(bytes)) throw new Error("A finished sticker is invalid or exceeds 100 KB.");
    files[manifest.stickers[i].file] = bytes;
  }
  return zipSync(files, { level: 0 });
}
function decodeFinished(manifest: any, bytes: Uint8Array): Collection {
  if (manifest.version !== 1 || typeof manifest.id !== "string" ||
    !/^[a-zA-Z0-9-]{1,120}$/.test(manifest.id) ||
    typeof manifest.name !== "string" || manifest.name.length > 64 ||
    typeof manifest.publisher !== "string" || manifest.publisher.length > 64 ||
    !Array.isArray(manifest.stickers) || !manifest.stickers.length || manifest.stickers.length > 30 ||
    !manifest.stickers.every((s: any, i: number) => s?.file === `stickers/${String(i + 1).padStart(2, "0")}.webp`))
    throw new Error("This finished pack format is not supported.");
  const names = new Set(manifest.stickers.map((s: any) => s.file));
  const files = unzipSync(bytes, { filter: f => names.has(f.name) && f.originalSize <= 100 * 1024 });
  const pack = newCollection();
  pack.name = manifest.name;
  pack.publisher = manifest.publisher;
  pack.origin = { id: manifest.id, creator: manifest.publisher };
  pack.items = manifest.stickers.map((s: any) => {
    const image = files[s.file];
    if (!image || !validWebP(image)) throw new Error("This finished pack contains a missing or invalid sticker.");
    return reaction({ ...defaultDesign(`data:image/webp;base64,${toBase64(image)}`),
      shape: "cutout", decoration: "none", flattened: true });
  });
  return pack;
}

export function fromBase64(value: string): Uint8Array {
  const raw = atob(value);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
export function toBase64(bytes: Uint8Array): string {
  let raw = "";
  for (let i = 0; i < bytes.length; i += 8192)
    raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(raw);
}
export async function encodeCollection(
  collection: Collection,
  stickers: Sticker[],
  read: (uri: string) => Promise<string>,
) {
  const portable: Collection = JSON.parse(JSON.stringify(collection));
  for (const item of portable.items) {
    item.design.source = await read(item.design.source);
    if (item.design.originalSource)
      item.design.originalSource = await read(item.design.originalSource);
  }
  const payload = strToU8(
    JSON.stringify({ format: "bias-studio", version: 1, collection: portable }),
  );
  if (payload.length > 60 * 1024 * 1024)
    throw new Error(
      "This pack is too large to share as one file. Split it into smaller collections.",
    );
  const files: Record<string, Uint8Array> = {
    "collection.json": payload,
    "READ-ME.txt": strToU8(
      "Open this ZIP with Import pack file in Bias Studio to edit or add it to WhatsApp. The stickers folder contains WebP images. Sharing this file does not install a sticker pack. Creator credit is in collection.json. Original photos, editable designs and AI creation descriptions are included; share only when you intend to share them.",
    ),
  };
  for (let i = 0; i < stickers.length; i++)
    files[`stickers/${String(i + 1).padStart(2, "0")}.webp`] = fromBase64(
      (await read(stickers[i].uri)).split(",")[1],
    );
  const bytes = zipSync(files, { level: 6 });
  if (bytes.length > 32 * 1024 * 1024)
    throw new Error(
      "This pack file exceeds 32 MB. Split it into smaller collections.",
    );
  return bytes;
}
export function decodeCollection(bytes: Uint8Array): Collection {
  if (bytes.length > 32 * 1024 * 1024)
    throw new Error("Choose a Bias Studio ZIP smaller than 32 MB.");
  let parsed: any;
  try {
    const files = unzipSync(bytes, {
      filter: (file) =>
        file.name === "collection.json" &&
        file.originalSize <= 60 * 1024 * 1024,
    });
    if (!files["collection.json"]) throw new Error();
    parsed = JSON.parse(strFromU8(files["collection.json"]));
  } catch {
    throw new Error(
      "This is not a readable Bias Studio pack file. Your workspace is unchanged.",
    );
  }
  if (parsed.format === "bias-studio-finished") return decodeFinished(parsed, bytes);
  if (
    parsed.format !== "bias-studio" ||
    parsed.version !== 1 ||
    !validCollection(parsed.collection)
  )
    throw new Error(
      "This pack format is not supported. Your workspace is unchanged.",
    );
  const pack: Collection = parsed.collection;
  for (const item of pack.items) {
    for (const uri of [item.design.source, item.design.originalSource]) {
      if (uri && !uri.startsWith("data:image/"))
        throw new Error(
          "A shared pack must include its images. External image links are not accepted.",
        );
    }
  }
  return {
    ...pack,
    id: newCollection().id,
    origin: pack.origin || { id: pack.id, creator: pack.publisher },
    items: pack.items.map(duplicate),
    updatedAt: Date.now(),
  };
}

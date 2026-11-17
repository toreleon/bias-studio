import { strToU8, strFromU8, zipSync, unzipSync } from "fflate";
import {
  Collection,
  duplicate,
  newCollection,
  validCollection,
} from "./workspace";
import { Sticker } from "./domain";

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

export const LIMITS = {
  minStickers: 3,
  maxStickers: 30,
  stickerBytes: 100 * 1024,
  trayBytes: 50 * 1024,
  size: 512,
} as const;
export type Shape = "cutout" | "rounded" | "circle";
export type Mood = "love" | "hype" | "happy";
export interface StickerDesign {
  source: string;
  caption: string;
  color: string;
  shape: Shape;
  zoom: number;
  x: number;
  y: number;
  decoration: "sparkles" | "hearts" | "none";
  sample?: Mood;
}
export interface Sticker {
  id: string;
  uri: string;
  bytes: number;
  width: number;
  height: number;
  caption: string;
  createdAt: number;
  sample?: Mood;
}
export interface Pack {
  id: string;
  name: string;
  publisher: string;
  color: string;
  stickers: Sticker[];
  updatedAt: number;
}
export interface Library {
  version: 1;
  packs: Pack[];
}
export const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
export const PALETTE = [
  "#A28AF0",
  "#FF8EB4",
  "#8BCCB5",
  "#FFC467",
  "#91B6F2",
  "#FAFAFA",
];
export const defaultDesign = (source = "", sample?: Mood): StickerDesign => ({
  source,
  caption: "",
  color: PALETTE[0],
  shape: sample ? "cutout" : "rounded",
  zoom: 1,
  x: 0,
  y: 0,
  decoration: "sparkles",
  sample,
});
export function createPack(name: string): Pack {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 64)
    throw new Error("Give your pack a name with 1–64 characters.");
  return {
    id: newId(),
    name: trimmed,
    publisher: "Bias Studio",
    color: PALETTE[0],
    stickers: [],
    updatedAt: Date.now(),
  };
}
export function packProblems(pack: Pack): string[] {
  const errors: string[] = [];
  if (!pack.name.trim() || pack.name.length > 128)
    errors.push("A pack needs a name of 1–128 characters.");
  if (pack.stickers.length < LIMITS.minStickers)
    errors.push(
      `Add ${LIMITS.minStickers - pack.stickers.length} more sticker${pack.stickers.length === 2 ? "" : "s"} to export this pack.`,
    );
  if (pack.stickers.length > LIMITS.maxStickers)
    errors.push("WhatsApp allows up to 30 stickers per pack.");
  for (const sticker of pack.stickers) {
    if (sticker.width !== 512 || sticker.height !== 512)
      errors.push("Every sticker must be 512 × 512 pixels.");
    if (
      !Number.isFinite(sticker.bytes) ||
      sticker.bytes <= 0 ||
      sticker.bytes > LIMITS.stickerBytes
    )
      errors.push("Every sticker must be under 100 KB.");
  }
  return [...new Set(errors)];
}
export function addSticker(pack: Pack, sticker: Sticker): Pack {
  if (pack.stickers.length >= LIMITS.maxStickers)
    throw new Error(
      "This pack is full. Create another pack for your next sticker.",
    );
  return {
    ...pack,
    stickers: [...pack.stickers, sticker],
    updatedAt: Date.now(),
  };
}
export function isLibrary(value: unknown): value is Library {
  if (!value || typeof value !== "object") return false;
  const l = value as Library;
  return (
    l.version === 1 &&
    Array.isArray(l.packs) &&
    l.packs.every(
      (p) =>
        p &&
        typeof p.id === "string" &&
        /^[a-zA-Z0-9-]+$/.test(p.id) &&
        typeof p.name === "string" &&
        typeof p.publisher === "string" &&
        typeof p.color === "string" &&
        typeof p.updatedAt === "number" &&
        Array.isArray(p.stickers) &&
        p.stickers.length <= 30 &&
        p.stickers.every(
          (s) =>
            s &&
            typeof s.id === "string" &&
            typeof s.uri === "string" &&
            typeof s.caption === "string" &&
            typeof s.createdAt === "number" &&
            typeof s.bytes === "number" &&
            s.bytes > 0 &&
            s.width === 512 &&
            s.height === 512,
        ),
    )
  );
}

import { defaultDesign, isLibrary, newId, Pack, StickerDesign } from "./domain";

export type Tags = {
  fandom: string;
  member: string;
  era: string;
  emotion: string;
};
export type Reaction = {
  id: string;
  design: StickerDesign;
  tags: Tags;
  createdAt: number;
  source?: { name: string; seconds?: number };
  legacy?: boolean;
};
export type Collection = {
  id: string;
  name: string;
  publisher: string;
  color: string;
  items: Reaction[];
  createdAt: number;
  updatedAt: number;
  origin?: { id: string; creator: string };
};
export type PackStyle = Pick<
  StickerDesign,
  | "color"
  | "shape"
  | "decoration"
  | "font"
  | "captionColor"
  | "captionPosition"
  | "outline"
  | "outlineColor"
>;
export type SavedStyle = { id: string; name: string; style: PackStyle };
export type Workspace = {
  version: 2;
  collections: Collection[];
  assets: Reaction[];
  styles: SavedStyle[];
};
export const emptyWorkspace = (): Workspace => ({
  version: 2,
  collections: [],
  assets: [],
  styles: [],
});
export const emptyTags = (): Tags => ({
  fandom: "",
  member: "",
  era: "",
  emotion: "",
});
export const captions = [
  "my whole heart",
  "LET’S GOOO",
  "I am not okay",
  "you did that!",
  "respectfully… wow",
  "we won",
  "no thoughts",
  "on repeat",
];
export const title = (pack: Collection) =>
  pack.name.trim() || "Untitled reaction pack";
export function newCollection(): Collection {
  return {
    id: newId(),
    name: "",
    publisher: "",
    color: "#7954DA",
    items: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
export function reaction(
  design: StickerDesign,
  source?: Reaction["source"],
): Reaction {
  return {
    id: newId(),
    design,
    tags: emptyTags(),
    createdAt: Date.now(),
    source,
  };
}
export function duplicate(item: Reaction): Reaction {
  return { ...structuredCloneSafe(item), id: newId(), createdAt: Date.now() };
}
function structuredCloneSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
export function styleOf(design: StickerDesign): PackStyle {
  const {
    color,
    shape,
    decoration,
    font = "rounded",
    captionColor = "#30233E",
    captionPosition = "bottom",
    outline = 12,
    outlineColor = "#FFFFFF",
  } = design;
  return {
    color,
    shape,
    decoration,
    font,
    captionColor,
    captionPosition,
    outline,
    outlineColor,
  };
}
export function applyStyle(
  pack: Collection,
  ids: string[],
  style: Partial<PackStyle>,
): Collection {
  return {
    ...pack,
    updatedAt: Date.now(),
    items: pack.items.map((item) =>
      ids.includes(item.id)
        ? { ...item, design: { ...item.design, ...style } }
        : item,
    ),
  };
}
export function appendItems(pack: Collection, items: Reaction[]): Collection {
  if (pack.items.length + items.length > 30)
    throw new Error(
      "A pack holds up to 30 reactions. Select fewer moments or start another pack.",
    );
  return { ...pack, updatedAt: Date.now(), items: [...pack.items, ...items] };
}
export function matches(item: Reaction, query: string, emotion: string) {
  const haystack = [
    item.design.caption,
    ...Object.values(item.tags),
    item.source?.name || "",
  ]
    .join(" ")
    .toLocaleLowerCase();
  return (
    (!emotion || item.tags.emotion === emotion) &&
    query
      .toLocaleLowerCase()
      .split(/\s+/)
      .every((word) => haystack.includes(word))
  );
}
function migratePack(pack: Pack): Collection {
  return {
    id: pack.id,
    name: pack.name,
    publisher: pack.publisher,
    color: pack.color,
    createdAt: pack.updatedAt,
    updatedAt: pack.updatedAt,
    items: pack.stickers.map((s) => ({
      ...reaction({
        ...defaultDesign(s.uri),
        shape: "cutout",
        decoration: "none",
        flattened: true,
      }),
      id: s.id,
      createdAt: s.createdAt,
      legacy: true,
      tags: { ...emptyTags(), emotion: "" },
      source: { name: s.caption || "Original MVP sticker" },
    })),
  };
}
export function migrate(value: unknown): Workspace {
  if (isLibrary(value)) {
    const collections = value.packs.map(migratePack);
    return {
      version: 2,
      collections,
      assets: collections.flatMap((p) => p.items),
      styles: [],
    };
  }
  if (validWorkspace(value)) return value;
  throw new Error(
    "Your saved workspace could not be read. It has been kept intact.",
  );
}
const record = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length <= max;
const id = (v: unknown) =>
  typeof v === "string" && /^[a-zA-Z0-9-]{1,120}$/.test(v);
const finite = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const color = (v: unknown) =>
  typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
export const imageURI = (v: unknown): v is string =>
  typeof v === "string" &&
  (v === "" ||
    /^file:\/\//.test(v) ||
    /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(v));
export function validStyle(v: unknown): v is PackStyle {
  return (
    record(v) &&
    color(v.color) &&
    ["rounded", "circle", "cutout"].includes(v.shape) &&
    ["none", "sparkles", "hearts"].includes(v.decoration) &&
    (v.font === undefined || ["rounded", "serif", "mono"].includes(v.font)) &&
    (v.captionPosition === undefined ||
      ["top", "bottom", "middle"].includes(v.captionPosition)) &&
    (v.captionColor === undefined || color(v.captionColor)) &&
    (v.outlineColor === undefined || color(v.outlineColor)) &&
    (v.outline === undefined || finite(v.outline, 0, 24))
  );
}
export function validReaction(v: unknown): v is Reaction {
  if (
    !record(v) ||
    !id(v.id) ||
    !record(v.design) ||
    !validStyle(v.design) ||
    !record(v.tags)
  )
    return false;
  const d: Record<string, any> = v.design;
  return (
    imageURI(d.source) &&
    (d.source !== "" || d.sample !== undefined) &&
    (d.originalSource === undefined || imageURI(d.originalSource)) &&
    text(d.caption, 28) &&
    finite(d.zoom, 1, 3) &&
    finite(d.x, -180, 180) &&
    finite(d.y, -160, 160) &&
    (d.sample === undefined || ["love", "hype", "happy"].includes(d.sample)) &&
    (d.flattened === undefined || typeof d.flattened === "boolean") &&
    ["fandom", "member", "era", "emotion"].every((k) => text(v.tags[k], 80)) &&
    finite(v.createdAt, 0, Number.MAX_SAFE_INTEGER) &&
    (!v.source ||
      (record(v.source) &&
        text(v.source.name, 256) &&
        (v.source.seconds === undefined ||
          finite(v.source.seconds, 0, 86400)))) &&
    (!d.strokes ||
      (Array.isArray(d.strokes) &&
        d.strokes.length <= 1000 &&
        d.strokes.every(
          (s: any) =>
            record(s) &&
            ["erase", "restore"].includes(s.mode) &&
            finite(s.radius, 2, 80) &&
            Array.isArray(s.points) &&
            s.points.length > 0 &&
            s.points.length <= 2000 &&
            s.points.every(
              (p: any) =>
                record(p) && finite(p.x, 0, 512) && finite(p.y, 0, 512),
            ),
        )))
  );
}
const unique = (items: { id: string }[]) =>
  new Set(items.map((i) => i.id)).size === items.length;
export function validCollection(v: unknown): v is Collection {
  return (
    record(v) &&
    id(v.id) &&
    text(v.name, 64) &&
    text(v.publisher, 64) &&
    color(v.color) &&
    finite(v.updatedAt, 0, Number.MAX_SAFE_INTEGER) &&
    finite(v.createdAt, 0, Number.MAX_SAFE_INTEGER) &&
    Array.isArray(v.items) &&
    v.items.length <= 30 &&
    v.items.every(validReaction) &&
    unique(v.items) &&
    (!v.origin ||
      (record(v.origin) && id(v.origin.id) && text(v.origin.creator, 64)))
  );
}
export function validWorkspace(v: unknown): v is Workspace {
  return (
    record(v) &&
    v.version === 2 &&
    Array.isArray(v.collections) &&
    v.collections.every(validCollection) &&
    unique(v.collections) &&
    Array.isArray(v.assets) &&
    v.assets.every(validReaction) &&
    unique(v.assets) &&
    Array.isArray(v.styles) &&
    v.styles.every(
      (s: any) =>
        record(s) && id(s.id) && text(s.name, 64) && validStyle(s.style),
    ) &&
    unique(v.styles)
  );
}

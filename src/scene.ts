import { StickerDesign, Mood } from "./domain";

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[char]!,
  );

// Original illustrative characters. No celebrity photographs are bundled.
export function character(mood: Mood = "love") {
  const eyes =
    mood === "happy"
      ? '<path d="M190 220q15-20 30 0m72 0q15-20 30 0" fill="none" stroke="#302737" stroke-width="9" stroke-linecap="round"/>'
      : '<ellipse cx="207" cy="216" rx="6" ry="10" fill="#302737"/><ellipse cx="305" cy="216" rx="6" ry="10" fill="#302737"/>';
  return `<g transform="translate(0,-5)">
    <path d="M146 405q4-104 110-104t110 104" fill="${mood === "hype" ? "#B5A2EE" : mood === "happy" ? "#8DCAB2" : "#F8AAC2"}" stroke="white" stroke-width="16"/>
    <path d="M227 300v32q29 23 58 0v-32" fill="#EDBEA6"/>
    <ellipse cx="256" cy="212" rx="98" ry="105" fill="#EDBEA6" stroke="white" stroke-width="15"/>
    <ellipse cx="161" cy="224" rx="16" ry="24" fill="#EDBEA6"/><ellipse cx="351" cy="224" rx="16" ry="24" fill="#EDBEA6"/>
    <path d="M159 204q-24-111 91-119 121-8 111 118l-27-39q-49 13-74-22-26 47-97 43z" fill="#3E333F" stroke="white" stroke-width="12" stroke-linejoin="round"/>
    <path d="M183 143q38-48 103-28" fill="none" stroke="#635061" stroke-width="9" stroke-linecap="round"/>
    ${eyes}<ellipse cx="188" cy="245" rx="19" ry="9" fill="#F39DAD" opacity=".7"/><ellipse cx="324" cy="245" rx="19" ry="9" fill="#F39DAD" opacity=".7"/>
    <path d="M240 259q17 16 34-1" fill="none" stroke="#6E3F48" stroke-width="7" stroke-linecap="round"/>
    ${mood === "hype" ? '<path d="M145 344l-34-48-22 12 21 78m258-42 34-48 22 12-21 78" fill="#EDBEA6" stroke="white" stroke-width="12" stroke-linejoin="round"/>' : '<path d="M201 379l35-34 20 16 20-16 35 34" fill="none" stroke="#EDBEA6" stroke-width="25" stroke-linecap="round"/>'}
    ${mood === "love" ? '<path d="M256 377c-42-28-28-48-9-37l9 9 9-9c19-11 33 9-9 37" fill="#DD547D"/>' : ""}
  </g>`;
}

export function scene(
  design: StickerDesign,
  imageData?: string,
  identifier = "sticker",
  platform = "web",
): string {
  const { color, shape, zoom, x, y, decoration } = design;
  const caption = design.caption.trim().slice(0, 28);
  const image = design.flattened
    ? `<image href="${escape(imageData || design.source)}" width="512" height="512"/>`
    : design.sample
      ? character(design.sample)
      : `<g${shape === "cutout" ? "" : ' clip-path="url(#crop)"'}><image href="${escape(imageData || design.source)}" x="${56 + x - (zoom - 1) * 200}" y="${44 + y - (zoom - 1) * 176}" width="${400 * zoom}" height="${352 * zoom}" preserveAspectRatio="xMidYMid ${shape === "cutout" ? "meet" : "slice"}"/></g>`;
  const backing =
    shape === "cutout"
      ? ""
      : shape === "circle"
        ? `<circle cx="256" cy="220" r="184" fill="${color}" stroke="white" stroke-width="16"/>`
        : `<rect x="48" y="36" width="416" height="368" rx="${shape === "rounded" ? "60" : "0"}" fill="${color}" stroke="white" stroke-width="16"/>`;
  const clipping =
    shape === "circle"
      ? '<circle cx="256" cy="220" r="176"/>'
      : '<rect x="56" y="44" width="400" height="352" rx="52"/>';
  const ornaments =
    decoration === "sparkles"
      ? `<path d="M418 90l10 25 26 10-26 10-10 26-10-26-25-10 25-10zM82 290l7 18 18 7-18 7-7 18-7-18-18-7 18-7z" fill="${color}" stroke="white" stroke-width="6" stroke-linejoin="round"/>`
      : decoration === "hearts"
        ? `<path d="M420 150c-69-45-46-81-15-62l15 15 15-15c31-19 54 17-15 62M88 333c-43-28-29-50-9-38l9 9 9-9c20-12 34 10-9 38" fill="${color}" stroke="white" stroke-width="6"/>`
        : "";
  const font =
    design.font === "serif"
      ? platform === "ios"
        ? "Georgia"
        : "serif"
      : design.font === "mono"
        ? platform === "ios"
          ? "Courier"
          : "monospace"
        : platform === "ios"
          ? "Arial"
          : "sans-serif";
  const captionY =
    design.captionPosition === "top"
      ? 74
      : design.captionPosition === "middle"
        ? 270
        : 449;
  const captionSize = caption.length > 19 ? 30 : caption.length > 12 ? 38 : 48;
  const strokes = design.strokes || [];
  const brush = () =>
    strokes
      .map(
        (stroke) =>
          `<path d="${stroke.points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ")}${stroke.points.length === 1 ? ` l0.01 0` : ""}" fill="none" stroke="${stroke.mode === "restore" ? "white" : "black"}" stroke-width="${stroke.radius * 2}" stroke-linecap="round" stroke-linejoin="round"/>`,
      )
      .join("");
  const restored =
    design.originalSource && strokes.some((s) => s.mode === "restore")
      ? design.flattened
        ? `<g mask="url(#restore)"><image href="${escape(design.originalSource)}" width="512" height="512"/></g>`
        : `<g mask="url(#restore)"><image href="${escape(design.originalSource)}" x="${56 + x - (zoom - 1) * 200}" y="${44 + y - (zoom - 1) * 176}" width="${400 * zoom}" height="${352 * zoom}" preserveAspectRatio="xMidYMid meet"/></g>`
      : "";
  const letters = caption
    ? `<text x="256" y="${captionY}" text-anchor="middle" font-family="${font}" font-weight="900" font-size="${captionSize}" stroke="${design.outlineColor || "#FFFFFF"}" stroke-width="${design.outline ?? 14}" stroke-linejoin="round" fill="${design.captionColor || "#44334F"}">${escape(caption)}</text><text x="256" y="${captionY}" text-anchor="middle" font-family="${font}" font-weight="900" font-size="${captionSize}" fill="${design.captionColor || "#44334F"}">${escape(caption)}</text>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="512" height="512" viewBox="0 0 512 512"><defs><clipPath id="crop">${clipping}</clipPath><mask id="erase"><rect width="512" height="512" fill="white"/>${brush()}</mask><mask id="restore"><rect width="512" height="512" fill="black"/>${brush()}</mask></defs><g mask="url(#erase)">${design.flattened ? "" : backing}${image}</g>${restored}${ornaments}${letters}</svg>`
    .replace(
      /id="(crop|erase|restore)"/g,
      (_, id) => `id="${identifier}-${id}"`,
    )
    .replace(
      /url\(#(crop|erase|restore)\)/g,
      (_, id) => `url(#${identifier}-${id})`,
    );
}

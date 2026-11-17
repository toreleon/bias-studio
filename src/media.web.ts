import { LIMITS, Pack, Sticker, StickerDesign, newId } from "./domain";
import { scene } from "./scene";
export interface Media {
  uri: string;
  kind: "photo" | "video";
  duration: number;
  name?: string;
}
export async function pickMedia(kind: Media["kind"]): Promise<Media | null> {
  return (await pickMany(kind, 1))[0] || null;
}
export async function pickMany(
  kind: Media["kind"],
  limit = 30,
): Promise<Media[]> {
  const files = await new Promise<File[]>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = kind === "photo";
    input.accept = kind === "video" ? "video/*" : "image/*";
    input.onchange = () => resolve(Array.from(input.files || []));
    input.oncancel = () => resolve([]);
    input.click();
  });
  if (files.length > limit)
    throw new Error(`Choose up to ${limit} photos for this pack.`);
  const items: Media[] = [];
  for (const file of files) {
    if (file.size > 150 * 1024 * 1024)
      throw new Error("Choose a file smaller than 150 MB.");
    if (kind === "video") {
      const uri = URL.createObjectURL(file);
      const duration = await new Promise<number>((resolve, reject) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
          resolve(Number.isFinite(video.duration) ? video.duration : 0);
          video.removeAttribute("src");
          video.load();
        };
        video.onerror = () => {
          URL.revokeObjectURL(uri);
          reject(
            new Error("Your browser cannot read this video. Try an MP4 file."),
          );
        };
        video.src = uri;
      });
      items.push({ uri, kind, duration, name: file.name });
    } else {
      const uri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () =>
          reject(new Error("This photo could not be read."));
        reader.readAsDataURL(file);
      });
      items.push({
        uri: await persistImage(uri),
        kind,
        duration: 0,
        name: file.name,
      });
    }
  }
  return items;
}
export async function persistImage(uri: string) {
  let image: HTMLImageElement;
  try {
    image = await loadImage(uri);
  } catch {
    throw new Error(
      "A shared image could not be read. Your existing workspace is unchanged.",
    );
  }
  // Keep already compact media byte-for-byte; repeated library reuse must not
  // repeatedly recompress it. Imported archives receive the same size guard.
  if (
    /^data:image\/(png|jpeg|webp);base64,/.test(uri) &&
    image.width <= 1200 &&
    image.height <= 1200 &&
    uri.length <= 128 * 1024
  ) return uri;
  const canvas = document.createElement("canvas");
  return compactSource(canvas, image, image.width, image.height);
}

/** Bound browser sources before duplicating editable designs in local storage. */
function compactSource(
  canvas: HTMLCanvasElement,
  image: CanvasImageSource,
  width: number,
  height: number,
) {
  for (const bound of [1200, 900, 675, 512]) {
    const scale = Math.min(1, bound / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.9, 0.8, 0.7, 0.6]) {
      const data = canvas.toDataURL("image/webp", quality);
      if (!data.startsWith("data:image/webp"))
        throw new Error("Update your browser to save compact transparent images, or use the native app.");
      // 128 KiB of base64 is approximately 96 KiB of encoded image data.
      if (data.length <= 128 * 1024) return data;
    }
  }
  throw new Error("This image is too detailed for browser storage. Crop it first or import it in the native app.");
}
export async function imageData(uri: string) {
  return uri;
}
export async function videoFrame(
  uri: string,
  seconds: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    const clean = () => {
      video.removeAttribute("src");
      video.load();
    };
    video.onerror = () => {
      clean();
      reject(new Error("This video frame could not be read. Try another MP4."));
    };
    video.onloadeddata = () => {
      video.currentTime = Math.min(
        Math.max(seconds, 0.001),
        Math.max(video.duration - 0.01, 0.001),
      );
    };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      try {
        resolve(compactSource(canvas, video, video.videoWidth, video.videoHeight));
      } catch (error) {
        reject(error);
      } finally {
        clean();
      }
    };
    video.src = uri;
  });
}
export const cutoutAvailable = false;
export async function removeBackground(_uri: string): Promise<string> {
  throw new Error(
    "Person cutout is available in the native iPhone and Android builds. You can try frames and captions here.",
  );
}
function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("This image format is not supported. Try PNG or JPEG."));
    image.src = uri;
  });
}
export async function renderSticker(
  design: StickerDesign,
  _view?: any,
): Promise<Sticker> {
  if (design.source && !design.sample) await loadImage(design.source);
  if (design.originalSource) await loadImage(design.originalSource);
  const svg = scene(design);
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  let image: HTMLImageElement;
  try {
    image = await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  canvas.getContext("2d")!.drawImage(image, 0, 0);
  let uri = "";
  let bytes = 0;
  for (const quality of [0.95, 0.8, 0.6, 0.4, 0.2, 0.08]) {
    uri = canvas.toDataURL("image/webp", quality);
    if (!uri.startsWith("data:image/webp"))
      throw new Error("Use a browser that supports WebP, such as Chrome.");
    bytes =
      Math.floor((uri.split(",")[1].length * 3) / 4) -
      (uri.endsWith("==") ? 2 : uri.endsWith("=") ? 1 : 0);
    if (bytes <= LIMITS.stickerBytes) break;
  }
  if (bytes > LIMITS.stickerBytes)
    throw new Error("This image is too detailed. Try a closer crop.");
  return {
    id: newId(),
    uri,
    caption: design.caption,
    bytes,
    width: 512,
    height: 512,
    createdAt: Date.now(),
  };
}
export async function exportWhatsApp(_pack: Pack) {
  throw new Error(
    "WhatsApp pack export is available in the native iPhone and Android builds. In this browser preview, you can create packs and download individual stickers.",
  );
}
export async function shareSticker(sticker: Sticker) {
  const anchor = document.createElement("a");
  anchor.href = sticker.uri;
  anchor.download = `bias-studio-${sticker.id}.webp`;
  anchor.click();
}
export async function discardSticker(_sticker: Sticker) {
  /* Data URLs are released with the unsaved draft. */
}

export async function prepareGeneratedImage(uri: string): Promise<string> {
  const image = await loadImage(uri);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const scale = Math.min(512 / image.width, 512 / image.height);
  canvas
    .getContext("2d")!
    .drawImage(
      image,
      (512 - image.width * scale) / 2,
      (512 - image.height * scale) / 2,
      image.width * scale,
      image.height * scale,
    );
  const compact = canvas.toDataURL("image/webp", 0.92);
  return compact.startsWith("data:image/webp")
    ? compact
    : canvas.toDataURL("image/png");
}

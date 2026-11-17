import { LIMITS, Pack, Sticker, StickerDesign, newId } from "./domain";
import { scene } from "./scene";
export interface Media {
  uri: string;
  kind: "photo" | "video";
  duration: number;
}
export async function pickMedia(kind: Media["kind"]): Promise<Media | null> {
  const file = await new Promise<File | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = kind === "video" ? "video/*" : "image/*";
    input.onchange = () => resolve(input.files?.[0] || null);
    input.oncancel = () => resolve(null);
    input.click();
  });
  if (!file) return null;
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
    return { uri, kind, duration };
  }
  const uri = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("This photo could not be read."));
    reader.readAsDataURL(file);
  });
  const image = await loadImage(uri);
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
  canvas.width = image.width * scale;
  canvas.height = image.height * scale;
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { uri: canvas.toDataURL("image/png"), kind, duration: 0 };
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
      const ratio = Math.min(
        1,
        1200 / Math.max(video.videoWidth, video.videoHeight),
      );
      canvas.width = video.videoWidth * ratio;
      canvas.height = video.videoHeight * ratio;
      canvas
        .getContext("2d")!
        .drawImage(video, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/png");
      clean();
      resolve(data);
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

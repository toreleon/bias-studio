import * as ImagePicker from "expo-image-picker";
import * as Thumbnails from "expo-video-thumbnails";
import * as FS from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { nativeBridge } from "./bridge";
import {
  LIMITS,
  Pack,
  Sticker,
  StickerDesign,
  newId,
  packProblems,
} from "./domain";

export interface Media {
  uri: string;
  kind: "photo" | "video";
  duration: number;
}
export async function pickMedia(kind: Media["kind"]): Promise<Media | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: kind === "video" ? ["videos"] : ["images"],
    quality: 1,
    allowsEditing: kind === "photo",
    exif: false,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  if (kind === "video")
    return {
      uri: asset.uri,
      kind,
      duration: Math.max(0, (asset.duration || 0) / 1000),
    };
  const resized = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: boundedDimensions(asset.width, asset.height) }],
    { format: ImageManipulator.SaveFormat.PNG },
  );
  return { uri: resized.uri, kind, duration: 0 };
}
export async function videoFrame(
  uri: string,
  seconds: number,
): Promise<string> {
  const frame = await Thumbnails.getThumbnailAsync(uri, {
    time: Math.round(seconds * 1000),
    quality: 1,
  });
  const resized = await ImageManipulator.manipulateAsync(
    frame.uri,
    [{ resize: boundedDimensions(frame.width, frame.height) }],
    { format: ImageManipulator.SaveFormat.PNG },
  );
  return resized.uri;
}
function boundedDimensions(width: number, height: number) {
  const scale = Math.min(1, 1200 / Math.max(width || 1200, height || 1200));
  return { width: Math.max(1, Math.round((width || 1200) * scale)), height: Math.max(1, Math.round((height || 1200) * scale)) };
}
export const cutoutAvailable = !!nativeBridge;
export async function removeBackground(uri: string) {
  if (!nativeBridge)
    throw new Error("Person cutout needs the native development build.");
  return nativeBridge.removeBackground(uri);
}
export async function renderSticker(
  design: StickerDesign,
  view?: any,
): Promise<Sticker> {
  const shot = await captureRef(view, {
    format: "png",
    quality: 1,
    result: "tmpfile",
    width: 512,
    height: 512,
  });
  let result: ImageManipulator.ImageResult | undefined;
  let bytes = 0;
  for (const compress of [0.95, 0.8, 0.6, 0.4, 0.2, 0.08]) {
    if (result) await FS.deleteAsync(result.uri, { idempotent: true });
    result = await ImageManipulator.manipulateAsync(
      shot,
      [{ resize: { width: 512, height: 512 } }],
      { format: ImageManipulator.SaveFormat.WEBP, compress },
    );
    const info = await FS.getInfoAsync(result.uri);
    bytes = info.exists ? info.size : 0;
    if (bytes > 0 && bytes <= LIMITS.stickerBytes) break;
  }
  await FS.deleteAsync(shot, { idempotent: true });
  if (!result || !bytes || bytes > LIMITS.stickerBytes)
    throw new Error(
      "This image is too detailed for WhatsApp. Try a closer crop or a cutout.",
    );
  const id = newId();
  const root = `${FS.documentDirectory}stickers/`;
  await FS.makeDirectoryAsync(root, { intermediates: true });
  const uri = `${root}${id}.webp`;
  await FS.copyAsync({ from: result.uri, to: uri });
  await FS.deleteAsync(result.uri, { idempotent: true });
  return {
    id,
    uri,
    caption: design.caption,
    bytes,
    width: 512,
    height: 512,
    createdAt: Date.now(),
  };
}
export async function exportWhatsApp(pack: Pack) {
  const problems = packProblems(pack);
  if (problems.length) throw new Error(problems[0]);
  if (!nativeBridge)
    throw new Error(
      "Open Bias Studio in its native development build to add this pack to WhatsApp.",
    );
  const tray = await ImageManipulator.manipulateAsync(
    pack.stickers[0].uri,
    [{ resize: { width: 96, height: 96 } }],
    { format: ImageManipulator.SaveFormat.PNG },
  );
  const trayInfo = await FS.getInfoAsync(tray.uri);
  if (!trayInfo.exists || trayInfo.size > LIMITS.trayBytes)
    throw new Error("The pack icon is too large. Use a simpler first sticker.");
  const opened = await nativeBridge.exportPack(
    JSON.stringify({
      ...pack,
      id: `${pack.id}-${pack.updatedAt.toString(36)}`,
      trayUri: tray.uri,
    }),
  );
  await FS.deleteAsync(tray.uri, { idempotent: true });
  if (!opened) throw new Error("Install WhatsApp to add this sticker pack.");
}
export async function shareSticker(sticker: Sticker) {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("Sharing is not available on this device.");
  await Sharing.shareAsync(sticker.uri, {
    mimeType: "image/webp",
    UTI: "org.webmproject.webp",
    dialogTitle: "Share your sticker",
  });
}
export async function discardSticker(sticker: Sticker) {
  await FS.deleteAsync(sticker.uri, { idempotent: true });
}

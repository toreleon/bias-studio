import * as ImagePicker from "expo-image-picker";
import * as Thumbnails from "expo-video-thumbnails";
import * as FS from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { Platform } from "react-native";
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
  name?: string;
}
export async function pickMedia(kind: Media["kind"]): Promise<Media | null> {
  return (await pickMany(kind, 1))[0] || null;
}
export async function pickMany(
  kind: Media["kind"],
  limit = 30,
): Promise<Media[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: kind === "video" ? ["videos"] : ["images"],
    quality: 1,
    allowsEditing: false,
    allowsMultipleSelection: kind === "photo",
    selectionLimit: limit,
    orderedSelection: true,
    exif: false,
  });
  if (result.canceled) return [];
  if (result.assets.length > limit)
    throw new Error(`Choose up to ${limit} photos for this pack.`);
  const items: Media[] = [];
  for (const asset of result.assets) {
    if (kind === "video")
      items.push({
        uri: asset.uri,
        kind,
        duration: Math.max(0, (asset.duration || 0) / 1000),
        name: asset.fileName || "Video",
      });
    else {
      const resized = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: boundedDimensions(asset.width, asset.height) }],
        { format: ImageManipulator.SaveFormat.PNG },
      );
      items.push({
        uri: await persistImage(resized.uri),
        kind,
        duration: 0,
        name: asset.fileName || "Photo",
      });
    }
  }
  return items;
}
export async function persistImage(uri: string): Promise<string> {
  if (uri.startsWith("data:")) {
    // Decode shared media before it becomes a durable draft reference.
    let decoded: ImageManipulator.ImageResult;
    try {
      decoded = await ImageManipulator.manipulateAsync(uri, [], {
        format: ImageManipulator.SaveFormat.PNG,
      });
    } catch {
      throw new Error(
        "A shared image could not be read. Your existing workspace is unchanged.",
      );
    }
    try {
      return await persistImage(decoded.uri);
    } finally {
      await FS.deleteAsync(decoded.uri, { idempotent: true }).catch(() => {});
    }
  }
  const root = `${FS.documentDirectory}sources/`;
  if (uri.startsWith(root)) return uri;
  await FS.makeDirectoryAsync(root, { intermediates: true });
  const output = `${root}${newId()}.${uri.startsWith("data:image/webp") || uri.endsWith(".webp") ? "webp" : "png"}`;
  await FS.copyAsync({ from: uri, to: output });
  return output;
}
export async function imageData(uri: string): Promise<string> {
  if (!uri || uri.startsWith("data:")) return uri;
  const data = await FS.readAsStringAsync(uri, {
    encoding: FS.EncodingType.Base64,
  });
  return `data:image/${uri.endsWith(".webp") ? "webp" : "png"};base64,${data}`;
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
  return persistImage(resized.uri);
}
function boundedDimensions(width: number, height: number) {
  const scale = Math.min(1, 1200 / Math.max(width || 1200, height || 1200));
  return {
    width: Math.max(1, Math.round((width || 1200) * scale)),
    height: Math.max(1, Math.round((height || 1200) * scale)),
  };
}
export const cutoutAvailable = !!nativeBridge;
export async function removeBackground(uri: string) {
  if (!nativeBridge)
    throw new Error("Person cutout needs the native development build.");
  return persistImage(await nativeBridge.removeBackground(uri));
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
  try {
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
    if (!result || !bytes || bytes > LIMITS.stickerBytes)
      throw new Error(
        "This image is too detailed for WhatsApp. Try a closer crop or a cutout.",
      );
    const id = newId();
    const root = `${FS.documentDirectory}stickers/`;
    await FS.makeDirectoryAsync(root, { intermediates: true });
    const uri = `${root}${id}.webp`;
    await FS.copyAsync({ from: result.uri, to: uri });
    return {
      id,
      uri,
      caption: design.caption,
      bytes,
      width: 512,
      height: 512,
      createdAt: Date.now(),
    };
  } finally {
    await FS.deleteAsync(shot, { idempotent: true }).catch(() => {});
    if (result)
      await FS.deleteAsync(result.uri, { idempotent: true }).catch(() => {});
  }
}

export class WhatsAppExportError extends Error {
  constructor(
    public readonly code: "INVALID_PACK" | "UNAVAILABLE" | "PREPARATION_FAILED" | "HANDOFF_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "WhatsAppExportError";
  }
}

export async function exportWhatsApp(pack: Pack) {
  const problems = packProblems(pack);
  if (problems.length) throw new WhatsAppExportError("INVALID_PACK", problems[0]);
  if (!nativeBridge)
    throw new WhatsAppExportError("UNAVAILABLE",
      "Open Bias Studio in its native development build to add this pack to WhatsApp.",
    );
  let tray: ImageManipulator.ImageResult;
  try {
    tray = await ImageManipulator.manipulateAsync(
      pack.stickers[0].uri,
      [{ resize: { width: 96, height: 96 } }],
      { format: ImageManipulator.SaveFormat.PNG },
    );
  } catch {
    throw new WhatsAppExportError("PREPARATION_FAILED",
      "The first sticker could not be read to make a pack icon. Reopen that sticker, replace its photo if missing, then retry. Your draft is unchanged.");
  }
  try {
    const trayInfo = await FS.getInfoAsync(tray.uri);
    if (!trayInfo.exists || trayInfo.size > LIMITS.trayBytes)
      throw new WhatsAppExportError("INVALID_PACK",
        "The pack icon is too large. Use a simpler first sticker.",
      );
    const opened = await nativeBridge.exportPack(
      JSON.stringify({
        ...pack,
        id: `${pack.id}-${pack.updatedAt.toString(36)}`,
        trayUri: tray.uri,
      }),
    );
    if (!opened) throw new WhatsAppExportError("UNAVAILABLE",
      Platform.OS === "ios"
        ? "WhatsApp could not open on this iPhone. Install or update WhatsApp, open it once, then return here and retry. The pack has not been installed."
        : "No supported WhatsApp app could open this pack. Install or update WhatsApp or WhatsApp Business, open it once, then return here and retry. The pack has not been installed.");
  } catch (error) {
    if (error instanceof WhatsAppExportError) throw error;
    const reason = error instanceof Error ? error.message : "";
    if (/missing|not found|ENOENT|outside app|local images|could not read/i.test(reason))
      throw new WhatsAppExportError("PREPARATION_FAILED",
        "A sticker file could not be read. Reopen the affected sticker, replace any missing photo, and retry. Your draft is unchanged.");
    if (/dimensions|encoding|size limit|WebP|PNG|pack name|publisher|3.?30/i.test(reason))
      throw new WhatsAppExportError("INVALID_PACK",
        "WhatsApp could not use the prepared images or pack details. Check the name and creator credit, use 3–30 still stickers, and try a simpler crop or first sticker before retrying.");
    throw new WhatsAppExportError("HANDOFF_FAILED",
      Platform.OS === "ios"
        ? "The WhatsApp handoff did not finish. Keep both apps open, allow the paste request if iOS asks, then retry and confirm Add in WhatsApp. Your draft is safe; installation is not confirmed."
        : "The WhatsApp handoff did not finish. Open or update WhatsApp, return here and retry, then confirm Add there. Your draft is safe; installation is not confirmed.");
  } finally {
    // Cleanup must not turn an opened destination into a false export failure.
    await FS.deleteAsync(tray.uri, { idempotent: true }).catch(() => {});
  }
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

export async function prepareGeneratedImage(uri: string): Promise<string> {
  const resized = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 512, height: 512 } }],
    { format: ImageManipulator.SaveFormat.PNG },
  );
  try {
    return await persistImage(resized.uri);
  } finally {
    await FS.deleteAsync(resized.uri, { idempotent: true }).catch(() => {});
  }
}

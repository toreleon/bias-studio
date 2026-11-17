import * as FS from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { fromBase64, toBase64 } from "./portable";
export async function sharePackFile(bytes: Uint8Array, id: string) {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error(
      "File sharing is unavailable on this device. Your pack is saved; try again later.",
    );
  const uri = `${FS.cacheDirectory}bias-studio-${id}-${Date.now()}.zip`;
  await FS.writeAsStringAsync(uri, toBase64(bytes), {
    encoding: FS.EncodingType.Base64,
  });
  await Sharing.shareAsync(uri, {
    mimeType: "application/zip",
    UTI: "public.zip-archive",
    dialogTitle: "Share editable reaction pack",
  });
  // Keep the cache file: Android recipients may read it after the chooser returns.
  // The OS may evict it later; this is not a delivery receipt.
}
export async function pickPackFile(): Promise<Uint8Array | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      "application/zip",
      "application/x-zip-compressed",
      "application/octet-stream",
    ],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const file = result.assets[0];
  try {
    const info = await FS.getInfoAsync(file.uri);
    if (!info.exists || info.size > 32 * 1024 * 1024)
      throw new Error("Choose a Bias Studio ZIP smaller than 32 MB.");
    return fromBase64(
      await FS.readAsStringAsync(file.uri, {
        encoding: FS.EncodingType.Base64,
      }),
    );
  } finally {
    await FS.deleteAsync(file.uri, { idempotent: true });
  }
}

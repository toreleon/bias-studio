import type { Media } from "./media";
// Ephemeral handoff only: videos are never put in URLs or the persisted workspace.
const inbox = new Map<string, Media[]>();
export function stageImport(id: string, media: Media[]) {
  for (const files of inbox.values())
    for (const file of files)
      if (file.uri.startsWith("blob:")) URL.revokeObjectURL(file.uri);
  inbox.clear();
  inbox.set(id, media);
}
export function takeImport(id: string) {
  const media = inbox.get(id);
  inbox.delete(id);
  return media;
}

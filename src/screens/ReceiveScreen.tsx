import React, { useEffect, useState } from "react";
import { Image, Platform, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { Action, Shell, v } from "../CreatorUI";
import { T } from "../ui";
import { betaRequest, betaURL } from "../beta/client";
import { decodeCollection } from "../portable";
import { useWorkspace } from "../WorkspaceProvider";
import { persistImage } from "../media";

type PublicPack = {
  id: string; name: string; publisher: string;
  telegramURL: string | null;
  stickers: { imageURL: string; emoji: string }[];
};
export function ReceiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useWorkspace();
  const [pack, setPack] = useState<PublicPack | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [imported, setImported] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setError(""); setPack(null);
    if (!id || !/^[a-zA-Z0-9-]{1,120}$/.test(id)) { setError("This collection link is invalid."); return; }
    betaRequest<PublicPack>(`/public/packs/${id}`, { signal: controller.signal })
      .then(setPack).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Unable to open this collection."); });
    return () => controller.abort();
  }, [id, attempt]);
  async function receive() {
    await store.run("Downloading finished stickers…", async () => {
      if (imported) { await store.flush(); router.push(`/preview/${imported}`); return; }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await fetch(`${betaURL}/public/packs/${encodeURIComponent(id)}/download`, { signal: controller.signal });
        if (!response.ok) throw new Error("This collection is unavailable. It may have been unpublished. Your workspace is unchanged.");
        if (Number(response.headers.get("Content-Length")) > 32 * 1024 * 1024)
          throw new Error("This collection is too large to import.");
        const collection = decodeCollection(new Uint8Array(await response.arrayBuffer()));
        for (const item of collection.items) item.design.source = await persistImage(item.design.source);
        store.change(old => ({ ...old, collections: [collection, ...old.collections] }));
        setImported(collection.id);
        await store.flush();
        router.push(`/preview/${collection.id}`);
        store.notice("Finished stickers saved to your workspace. Choose Add to WhatsApp on a supported phone and confirm there. Saving is not installation.");
      } finally { clearTimeout(timeout); }
    });
  }
  return <Shell back={() => router.replace("/packs")} tab={false}>
    <T style={v.eyebrow}>A COLLECTION FOR YOUR CHAT</T>
    {error ? <><T style={v.sub}>{error}</T><Action label="Try opening collection again" onPress={() => setAttempt(n => n + 1)} /></> : !pack ? <T accessibilityLiveRegion="polite">Loading collection…</T> : <>
      <T style={v.title}>{pack.name}</T>
      <T style={v.sub}>Created by {pack.publisher} · {pack.stickers.length} reactions</T>
      <View style={v.wrap}>{pack.stickers.map((sticker, i) => <Image key={i} accessibilityLabel={`Reaction ${i + 1}`} source={{ uri: sticker.imageURL }} style={{ width: 140, height: 140 }} resizeMode="contain" />)}</View>
      <Action label={imported ? "Continue to pack preview" : "Save pack to Bias Studio"} onPress={receive} />
      <T style={v.small}>{Platform.OS === "web" ? "Adding to WhatsApp needs the native Bias Studio app on iPhone or Android." : "Next: preview the stickers, then choose Add to WhatsApp and confirm in WhatsApp."} Only finished images are included; original media and editable source layers remain with the creator.</T>
      {pack.telegramURL && /^https:\/\/t\.me\/addstickers\//.test(pack.telegramURL) && <Action label="Open sticker set in Telegram" onPress={() => store.run("Opening Telegram…", async () => { await Linking.openURL(pack.telegramURL!); })} />}
      <T style={v.small}>Downloading or opening a destination does not confirm installation. Previously saved copies remain available if the creator later unpublishes this page.</T>
    </>}
  </Shell>;
}

import React, { useEffect, useState } from "react";
import { Platform, Share, TextInput, View } from "react-native";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { MessageCircle, Share2 } from "lucide-react-native";
import { Action, Chip, Field, Journey, K, Shell, v } from "../CreatorUI";
import { Art, T } from "../ui";
import { useWorkspace } from "../WorkspaceProvider";
import { Collection, title } from "../workspace";
import { discardSticker, exportWhatsApp, imageData } from "../media";
import { encodeCollection, encodeFinishedCollection } from "../portable";
import { sharePackFile } from "../pack-file";
import { handoff } from "../exports";
import { nativeBridge } from "../bridge";
import { betaConnected, betaRequest, betaURL, connectBeta, disconnectBeta } from "../beta/client";
export function PreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useWorkspace();
  const pack = store.data.collections.find((p) => p.id === id);
  const [dark, setDark] = useState(false);
  const [sharing, setSharing] = useState(false);
  if (!pack)
    return (
      <Shell>
        <T>Pack not found.</T>
        <Action
          label="Back to packs"
          onPress={() => router.replace("/packs")}
        />
      </Shell>
    );
  const canWhatsApp = Platform.OS !== "web" && !!nativeBridge;
  async function send(kind: "whatsapp" | "file" | "editable") {
    if (!pack) return;
    await store.run("Preparing your reaction pack…", async () => {
      await store.flush();
      const stickers = await store.render(pack);
      try {
        if (kind === "whatsapp") {
          await handoff(pack, stickers, {
            id: "whatsapp",
            label: "WhatsApp",
            min: 3,
            max: 30,
            send: exportWhatsApp,
          });
          store.notice(
            "WhatsApp opened. Confirm Add there to install the pack. If you cancelled, your draft is still here.",
          );
        } else {
          const bytes = await (kind === "editable" ? encodeCollection : encodeFinishedCollection)(pack, stickers, imageData);
          await sharePackFile(bytes, pack.id);
          setSharing(false);
          store.notice(
            Platform.OS === "web"
              ? "Pack file downloaded. Recipients can open it with Import pack file in Bias Studio. This does not install it in a chat app."
              : "The pack file is ready in the share sheet. The recipient can import it in Bias Studio. Sharing or cancelling does not change your draft or confirm installation.",
          );
        }
      } finally {
        await Promise.all(
          stickers.map((s) => discardSticker(s).catch(() => {})),
        );
      }
    });
  }
  return (
    <Shell tab={false} back={() => router.push(`/pack/${id}`)}>
      <Journey step={3} />
      <T style={v.eyebrow}>THE GROUP CHAT TEST</T>
      <T style={v.title}>Ready for the chat?</T>
      <T style={v.sub}>
        Check each reaction at a realistic chat size. Small words need big
        personality.
      </T>
      <View style={v.wrap}>
        <Chip
          label="Light chat"
          selected={!dark}
          onPress={() => setDark(false)}
        />
        <Chip label="Dark chat" selected={dark} onPress={() => setDark(true)} />
      </View>
      <View
        style={{
          borderRadius: 24,
          backgroundColor: dark ? "#242330" : "#EAE8DD",
          overflow: "hidden",
          borderWidth: 1,
          borderColor: K.line,
        }}
      >
        <View
          style={[
            v.row,
            { backgroundColor: dark ? "#353143" : "#FFFFFFCC", padding: 16 },
          ]}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: K.lavender,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <T>✦</T>
          </View>
          <View>
            <T
              style={{
                color: dark ? "white" : K.ink,
                fontFamily: "DMSans_700Bold",
              }}
            >
              the bias group chat
            </T>
            <T style={{ fontSize: 11, color: dark ? "#D8CEE4" : K.muted }}>
              Preview only · nothing is sent
            </T>
          </View>
        </View>
        <View style={{ padding: 18, gap: 8 }}>
          <View
            style={{
              alignSelf: "flex-start",
              borderRadius: 14,
              padding: 12,
              backgroundColor: dark ? "#484254" : "white",
            }}
          >
            <T style={{ color: dark ? "white" : K.ink, fontSize: 13 }}>
              the new clip just dropped 👀
            </T>
          </View>
          {pack.items.map((item, i) => (
            <View
              key={item.id}
              style={{
                alignSelf: i % 2 ? "flex-start" : "flex-end",
                alignItems: "center",
              }}
            >
              <Art design={item.design} size={148} />
              <T style={{ fontSize: 10, color: dark ? "#CFC4DE" : K.muted }}>
                Reaction {i + 1}
              </T>
            </View>
          ))}
        </View>
      </View>
      <View style={v.card}>
        <T style={v.section}>Give your collection a signature</T>
        <Field
          label="Pack name"
          value={pack.name}
          onChange={(name) => store.updatePack(id, (p) => ({ ...p, name }))}
          placeholder="e.g. Encore energy"
        />
        <Field
          label="Creator credit"
          value={pack.publisher}
          onChange={(publisher) =>
            store.updatePack(id, (p) => ({ ...p, publisher }))
          }
          placeholder="Your creator name or handle"
        />
        <T style={v.small}>
          {title(pack)} · {pack.items.length} still stickers
        </T>
      </View>
      {canWhatsApp ? (
        <View style={v.card}>
          <T style={v.section}>Take it to WhatsApp</T>
          <T style={v.sub}>
            {pack.items.length < 3
              ? `Add ${3 - pack.items.length} more reactions to reach WhatsApp’s minimum of 3.`
              : "We prepare and validate every sticker before opening WhatsApp. Confirm installation there."}
          </T>
          <Action
            label="Add to WhatsApp"
            icon={MessageCircle}
            disabled={pack.items.length < 3}
            onPress={() => send("whatsapp")}
          />
        </View>
      ) : (
        <T style={v.small}>
          Adding packs to WhatsApp requires the native iPhone or Android app.
          The browser supports finished pack-file downloads.
        </T>
      )}
      <View style={[v.card, { backgroundColor: K.lavender }]}>
        <T style={v.section}>Share the whole collection</T>
        <T style={v.sub}>
          Finished stickers and creator credit. Original photos, editable
          designs and AI prompts stay on your device. Recipients import the ZIP into Bias Studio.
        </T>
        <Action
          label={
            Platform.OS === "web" ? "Download pack file" : "Share pack file"
          }
          icon={Share2}
          disabled={!pack.items.length}
          onPress={() => send("file")}
        />
        <Action secondary label="Share editable source files…" onPress={() => setSharing(true)} />
        {sharing && (
          <>
            <T style={v.sub}>
              This file includes original photos, cutouts, captions, tags,
              video timestamps and AI creation descriptions. Share it only with people you want to give these
              assets to. It does not create a public page or install a chat
              pack.
            </T>
            <Action
              label="Create editable pack file"
              onPress={() => send("editable")}
            />
            <Action
              secondary
              label="Cancel sharing"
              onPress={() => setSharing(false)}
            />
          </>
        )}
      </View>
      <OnlineSharing key={pack.id} pack={pack} />
      <Action
        secondary
        label="Save all reactions to library"
        onPress={() => {
          const items = pack.items;
          store.change((old) => ({
            ...old,
            assets: [
              ...old.assets.filter((a) => !items.some((i) => i.id === a.id)),
              ...JSON.parse(JSON.stringify(items)),
            ],
          }));
          store.notice(
            "Reactions saved to your library. Your next pack can start with these.",
          );
        }}
      />
      <T style={v.small}>
        Local drafts stay on this device. Online sharing uploads only the finished stickers you explicitly choose.
      </T>
    </Shell>
  );
}

type RemotePack = {
  id: string; name: string; publisher: string; published: boolean; revision: number;
  publicURL: string | null; telegramURL: string | null;
  telegramStatus?: string;
};
function OnlineSharing({ pack }: { pack: Collection }) {
  const store = useWorkspace();
  const [config, setConfig] = useState<{ publicPages: boolean; telegram: boolean } | null>(null);
  const [connected, setConnected] = useState(betaConnected());
  const [code, setCode] = useState("");
  const [remote, setRemote] = useState<RemotePack | null>(null);
  const [replacement, setReplacement] = useState<RemotePack | null>(null);
  const [owned, setOwned] = useState<RemotePack[]>([]);
  const [confirm, setConfirm] = useState<"publish" | "telegram" | null>(null);
  const [linked, setLinked] = useState(false);
  useEffect(() => {
    if (!betaURL) return;
    const controller = new AbortController();
    betaRequest<{ publicPages: boolean; telegram: boolean }>("/v1/config", { signal: controller.signal })
      .then(setConfig).catch(() => setConfig(null));
    return () => controller.abort();
  }, []);
  async function refresh() {
    setOwned(await betaRequest<RemotePack[]>("/v1/packs"));
    if (config?.telegram) {
      const status = await betaRequest<{ linked: boolean }>("/v1/telegram/link");
      setLinked(status.linked);
    }
  }
  async function upload() {
    await store.flush();
    const stickers = await store.render(pack);
    try {
      const result = await betaRequest<RemotePack>("/v1/packs", { method: "POST", body: {
        ...(remote ? { id: remote.id } : { clientId: pack.id }), name: title(pack), publisher: pack.publisher.trim(),
        stickers: await Promise.all(stickers.map(async s => ({ image: await imageData(s.uri), emoji: "💜" }))),
      } });
      setRemote(result);
      return result;
    } finally {
      await Promise.all(stickers.map(s => discardSticker(s).catch(() => {})));
    }
  }
  async function publish(destination: "publish" | "telegram") {
    await store.run(destination === "publish" ? "Publishing finished stickers…" : "Creating Telegram sticker set…", async () => {
      const saved = await upload();
      if (destination === "publish") {
        const published = await betaRequest<RemotePack>(`/v1/packs/${saved.id}/publish`, { method: "POST", body: { revision: saved.revision } });
        setRemote(published);
        store.notice("Your finished stickers, creator credit and account display name are public. Your originals and editable layers were not uploaded.");
      } else {
        const result = await betaRequest<{ status: string; url: string }>(`/v1/packs/${saved.id}/telegram`, { method: "POST", body: { revision: saved.revision } });
        if (result.status !== "verified" || !/^https:\/\/t\.me\/addstickers\//.test(result.url))
          throw new Error("Telegram has not confirmed this set. Refresh cloud copies before trying again.");
        setRemote({ ...saved, telegramURL: result.url });
        store.notice("Telegram verified the sticker set. Open its link and choose Add Stickers there. This does not confirm installation on your phone.");
      }
      setConfirm(null);
      await refresh();
    });
  }
  async function shareLink(url: string) {
    await store.run("Opening collection link…", async () => {
      if (!/^https?:\/\//.test(url)) throw new Error("This collection link is invalid.");
      if (Platform.OS === "web") await Linking.openURL(url);
      else await Share.share({ message: `${title(pack)} — ${url}` });
    });
  }
  if (!betaURL) return null;
  if (!config) return <T style={v.small}>Online sharing is unavailable. You can still share a finished pack file.</T>;
  if (!config.publicPages && !config.telegram) return null;
  return <View style={v.card}>
    <T style={v.section}>A link for your fandom</T>
    <T style={v.sub}>Publish a finished collection with your creator credit and account display name. Drafts stay private until you choose to share.</T>
    {!connected || !betaConnected() ? <>
      <T style={v.small}>Creator invite</T>
      <TextInput accessibilityLabel="Sharing creator invite" secureTextEntry autoCapitalize="none" autoCorrect={false}
        value={code} onChangeText={setCode} style={v.input} placeholder="Your beta invite" />
      <Action label="Connect creator account" disabled={!code.trim()} onPress={() => store.run("Connecting…", async () => {
        await connectBeta(code); setCode(""); setConnected(true); await refresh();
      })} />
    </> : <>
      {remote && <T style={v.small}>Next upload updates cloud collection “{remote.name}” from this local pack, “{title(pack)}”. Changed content makes the cloud page private until published again.</T>}
      {config.publicPages && <Action label="Publish collection page…" disabled={!pack.items.length || !pack.publisher.trim()}
        onPress={() => setConfirm("publish")} />}
      {!pack.publisher.trim() && <T style={v.small}>Add your creator credit above before publishing.</T>}
      {config.telegram && <>
        {!linked ? <>
          <Action secondary label="Connect Telegram" onPress={() => store.run("Preparing Telegram connection…", async () => {
            const link = await betaRequest<{ url: string }>("/v1/telegram/link", { method: "POST" });
            if (!/^https:\/\/t\.me\//.test(link.url)) throw new Error("The Telegram connection link is invalid.");
            await Linking.openURL(link.url);
            store.notice("Tap Start in Telegram, then return and check connection. This does not create a sticker set.");
          })} />
          <Action secondary label="Check Telegram connection" onPress={() => store.run("Checking connection…", refresh)} />
        </> : <Action label="Create Telegram sticker set…" disabled={!pack.items.length || !pack.publisher.trim()}
          onPress={() => setConfirm("telegram")} />}
      </>}
      {confirm && <View style={v.card}>
        <T style={v.sub}>{confirm === "publish"
          ? "Upload finished stickers, pack name, creator credit and your creator account display name to a public page anyone with its link can view. Original photos, prompts and editable designs stay private. Unpublishing cannot recall downloaded copies."
          : "Upload finished stickers and credit to the service and Telegram. Anyone with the Telegram link can use the set. Unpublishing a Bias Studio page cannot revoke Telegram copies."}</T>
        <Action label={confirm === "publish" ? "Publish finished collection" : "Confirm Telegram export"} onPress={() => publish(confirm)} />
        <Action secondary label="Keep draft private" onPress={() => setConfirm(null)} />
      </View>}
      {remote?.publicURL && remote.published && <>
        <T selectable style={v.small}>Public collection link: {remote.publicURL}</T>
        <Action label={Platform.OS === "web" ? "Open public collection page" : "Share public collection link"} onPress={() => shareLink(remote.publicURL!)} />
      </>}
      {remote?.telegramURL && <Action label="Open Telegram sticker set" onPress={() => store.run("Opening Telegram…", async () => { await Linking.openURL(remote.telegramURL!); })} />}
      <Action secondary label="Refresh my cloud copies" onPress={() => store.run("Loading your collections…", refresh)} />
      {owned.map(p => <View key={p.id} style={v.card}>
        <T style={v.small}>{p.name} · {p.published ? "Public page" : "Private cloud copy"}</T>
        {p.telegramStatus && p.telegramStatus !== "not_created" && <T style={v.small}>Telegram set: {p.telegramStatus}. A verified set is ready to open; it is not an installation receipt.</T>}
        {p.published && p.publicURL && <T selectable style={v.small}>{p.publicURL}</T>}
        <Action secondary label={`Update cloud copy ${p.name}…`} onPress={() => setReplacement(p)} />
        {replacement?.id === p.id && <>
          <T style={v.sub}>Use the currently open local pack “{title(pack)}” to replace cloud collection “{p.name}” on your next upload? Changed content makes that page private. Existing Telegram copies are not replaced or recalled.</T>
          <Action secondary label="Use this cloud copy for next upload" onPress={() => { setRemote(p); setReplacement(null); setConfirm(null); }} />
          <Action secondary label="Cancel cloud update" onPress={() => setReplacement(null)} />
        </>}
        {config.telegram && ["pending", "uncertain", "failed"].includes(p.telegramStatus || "") && <Action secondary
          label={p.telegramStatus === "failed" ? `Retry Telegram export for ${p.name}` : `Check Telegram export for ${p.name}`}
          onPress={() => store.run("Checking the existing Telegram export…", async () => {
            const result = await betaRequest<{ status: string; url: string }>(`/v1/packs/${p.id}/telegram`, { method: "POST", body: { revision: p.revision } });
            if (result.status !== "verified" || !/^https:\/\/t\.me\/addstickers\//.test(result.url))
              throw new Error("Telegram has not confirmed this set. Check again later; no new copy was uploaded.");
            if (remote?.id === p.id) setRemote({ ...remote, telegramURL: result.url, telegramStatus: "verified" });
            await refresh();
            store.notice("The existing Telegram set is verified. Open it and choose Add Stickers in Telegram.");
          })} />}
        {p.published && <Action secondary label={`Unpublish ${p.name}`} onPress={() => store.run("Unpublishing collection…", async () => {
          await betaRequest(`/v1/packs/${p.id}/unpublish`, { method: "POST" });
          if (remote?.id === p.id) setRemote({ ...remote, published: false, publicURL: null });
          await refresh(); store.notice("The public page is unavailable. Previously downloaded images and Telegram sets remain separate copies.");
        })} />}
        {p.telegramURL && <Action secondary label={`Open ${p.name} in Telegram`} onPress={() => store.run("Opening Telegram…", async () => { await Linking.openURL(p.telegramURL!); })} />}
      </View>)}
      <Action secondary label="Disconnect creator account" onPress={() => { disconnectBeta(); setConnected(false); setOwned([]); setRemote(null); setLinked(false); }} />
    </>}
  </View>;
}

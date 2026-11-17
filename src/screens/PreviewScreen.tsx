import React, { useState } from "react";
import { Platform, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MessageCircle, Share2 } from "lucide-react-native";
import { Action, Chip, Field, Journey, K, Shell, v } from "../CreatorUI";
import { Art, T } from "../ui";
import { useWorkspace } from "../WorkspaceProvider";
import { title } from "../workspace";
import { discardSticker, exportWhatsApp, imageData } from "../media";
import { encodeCollection } from "../portable";
import { sharePackFile } from "../pack-file";
import { handoff } from "../exports";
import { nativeBridge } from "../bridge";
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
  async function send(kind: "whatsapp" | "file") {
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
          const bytes = await encodeCollection(pack, stickers, imageData);
          await sharePackFile(bytes, pack.id);
          setSharing(false);
          store.notice(
            Platform.OS === "web"
              ? "Pack file downloaded. Send the ZIP to another creator; they can open it with Import pack file in Bias Studio. This does not install it in a chat app."
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
          The browser preview supports editable pack-file downloads.
        </T>
      )}
      <View style={[v.card, { backgroundColor: K.lavender }]}>
        <T style={v.section}>Share the whole collection</T>
        <T style={v.sub}>
          One portable file with every sticker, editable design and creator
          credit. Recipients import it into Bias Studio.
        </T>
        <Action
          label={
            Platform.OS === "web" ? "Download pack file" : "Share pack file"
          }
          icon={Share2}
          disabled={!pack.items.length}
          onPress={() => setSharing(true)}
        />
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
              onPress={() => send("file")}
            />
            <Action
              secondary
              label="Cancel sharing"
              onPress={() => setSharing(false)}
            />
          </>
        )}
      </View>
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
        Your collections stay private on this device. No public link is created.
      </T>
    </Shell>
  );
}

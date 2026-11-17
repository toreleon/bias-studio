import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import {
  ArrowUpRight,
  Clapperboard,
  ImagePlus,
  Plus,
} from "lucide-react-native";
import { Action, K, PackCard, Shell, v } from "../CreatorUI";
import { Art, T } from "../ui";
import { useWorkspace } from "../WorkspaceProvider";
import { newCollection, reaction } from "../workspace";
import { defaultDesign } from "../domain";
import { decodeCollection } from "../portable";
import { pickPackFile } from "../pack-file";
import { persistImage } from "../media";
function useStart() {
  const store = useWorkspace();
  return (kind?: string) => {
    const pack = newCollection();
    store.change((old) => ({
      ...old,
      collections: [pack, ...old.collections],
    }));
    router.push({
      pathname: "/pack/[id]",
      params: { id: pack.id, ...(kind ? { import: kind } : {}) },
    });
  };
}
export function HomeScreen() {
  const store = useWorkspace();
  const start = useStart();
  const recent = [...store.data.collections]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 3);
  function demo() {
    const pack = newCollection();
    pack.items = ["love", "hype", "happy"].map((m: any, i) =>
      reaction({
        ...defaultDesign("", m),
        caption: ["my whole heart", "LET’S GOOO", "you did that!"][i],
      }),
    );
    store.change((old) => ({
      ...old,
      collections: [pack, ...old.collections],
    }));
    router.push(`/pack/${pack.id}`);
  }
  return (
    <Shell>
      <View style={[v.row, { justifyContent: "space-between" }]}>
        <T style={v.eyebrow}>YOUR FANDOM. YOUR FEELINGS.</T>
        <T style={v.small}>CREATOR SPACE</T>
      </View>
      <View
        style={{
          backgroundColor: K.ink,
          borderRadius: 30,
          padding: 24,
          overflow: "hidden",
          gap: 12,
        }}
      >
        <T style={[v.title, { color: "white", fontSize: 35, lineHeight: 39 }]}>
          Big feelings.{"\n"}Little stickers.
        </T>
        <T
          style={{
            color: "#DBD0EC",
            fontSize: 14,
            lineHeight: 22,
            maxWidth: 310,
          }}
        >
          Turn your favorite moments into a reaction pack. Keep the good ones
          for your next era.
        </T>
        <View
          style={{
            flexDirection: "row",
            height: 145,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {(["love", "hype", "happy"] as const).map((sample, i) => (
            <View
              key={sample}
              style={{
                marginHorizontal: -11,
                transform: [{ rotate: `${(i - 1) * 12}deg` }],
              }}
            >
              <Art
                size={145}
                design={{
                  ...defaultDesign("", sample),
                  caption: ["obsessed", "WE WON", "iconic"][i],
                  color: ["#FF8EB4", "#A28AF0", "#D8F785"][i],
                }}
              />
            </View>
          ))}
        </View>
        <Action
          label="Start a reaction pack"
          icon={Plus}
          onPress={() => start()}
        />
        <T style={{ textAlign: "center", fontSize: 11, color: "#DBD0EC" }}>
          No name needed. Drafts save as you create.
        </T>
      </View>
      <View style={v.row}>
        <View style={{ flex: 1 }}>
          <Action
            secondary
            label="Import photos"
            icon={ImagePlus}
            onPress={() => start("photo")}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Action
            secondary
            label="Pick video frames"
            icon={Clapperboard}
            onPress={() => start("video")}
          />
        </View>
      </View>
      <View style={[v.row, { justifyContent: "space-between" }]}>
        <T style={v.section}>Pick up where you left off</T>
        <T style={v.small}>{store.data.collections.length} packs</T>
      </View>
      {recent.length ? (
        recent.map((pack) => <PackCard key={pack.id} pack={pack} />)
      ) : (
        <View style={v.card}>
          <T style={{ fontFamily: "DMSans_700Bold", fontSize: 17 }}>
            Your first era starts here.
          </T>
          <T style={v.sub}>
            Bring a few photos or moments from a clip. Give the whole pack a
            look, then fine-tune your favorites.
          </T>
          <Action secondary label="Try a 3-reaction demo" onPress={demo} />
        </View>
      )}
      <View style={[v.card, { backgroundColor: "#EAF0E2" }]}>
        <T style={v.section}>Create once. React forever.</T>
        <T style={v.sub}>
          {store.data.assets.length} saved reactions ·{" "}
          {store.data.styles.length} reusable styles
        </T>
        <Action
          secondary
          label="Open reaction library"
          icon={ArrowUpRight}
          onPress={() => router.push("/library")}
        />
      </View>
      <T style={v.small}>
        Private on this device until you choose to share. Demo art is original
        illustration.
      </T>
    </Shell>
  );
}
export function PacksScreen() {
  const store = useWorkspace();
  const start = useStart();
  async function importPack() {
    await store.run("Opening pack file…", async () => {
      const bytes = await pickPackFile();
      if (!bytes) return;
      const pack = decodeCollection(bytes);
      for (const item of pack.items) {
        item.design.source = item.design.source
          ? await persistImage(item.design.source)
          : "";
        if (item.design.originalSource)
          item.design.originalSource = await persistImage(
            item.design.originalSource,
          );
      }
      store.change((old) => ({
        ...old,
        collections: [pack, ...old.collections],
      }));
      await store.flush();
      router.push(`/pack/${pack.id}`);
    });
  }
  return (
    <Shell>
      <T style={v.eyebrow}>YOUR COLLECTIONS</T>
      <T style={v.title}>A pack for every era.</T>
      <T style={v.sub}>
        Drafts and finished collections live together. Everything stays
        editable.
      </T>
      <View style={v.wrap}>
        <Action label="New pack" icon={Plus} onPress={() => start()} />
        <Action secondary label="Import pack file" onPress={importPack} />
      </View>
      {store.data.collections.length ? (
        [...store.data.collections]
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((p) => <PackCard key={p.id} pack={p} />)
      ) : (
        <View style={v.card}>
          <T style={v.section}>Room for your next obsession</T>
          <T style={v.sub}>
            Start with a photo, a video moment, or reactions from your library.
          </T>
        </View>
      )}
    </Shell>
  );
}

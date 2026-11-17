import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { DMSans_400Regular } from "@expo-google-fonts/dm-sans/400Regular";
import { DMSans_500Medium } from "@expo-google-fonts/dm-sans/500Medium";
import { DMSans_600SemiBold } from "@expo-google-fonts/dm-sans/600SemiBold";
import { DMSans_700Bold } from "@expo-google-fonts/dm-sans/700Bold";
import { DMSans_800ExtraBold } from "@expo-google-fonts/dm-sans/800ExtraBold";
import {
  ArrowDownToLine,
  ArrowLeft,
  Check,
  ChevronRight,
  CircleHelp,
  Clapperboard,
  FolderHeart,
  Heart,
  Layers,
  MessageCircle,
  Plus,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react-native";
import {
  addSticker,
  createPack,
  defaultDesign,
  Library,
  Mood,
  Pack,
  Sticker,
  StickerDesign,
} from "./domain";
import { loadLibrary, saveLibrary } from "./storage";
import {
  discardSticker,
  exportWhatsApp,
  Media,
  pickMedia,
  removeBackground,
  renderSticker,
  shareSticker,
  videoFrame,
} from "./media";
import { Button, C, IconButton, s, StickerImage, T } from "./ui";
import Editor from "./Editor";
import Home from "./Home";

type Tab = "workshop" | "packs" | "about";
type Dialog = {
  title: string;
  body: string;
  action?: () => void;
  label?: string;
};
const NAV = [
  { tab: "workshop", title: "Workshop", icon: WandSparkles },
  { tab: "packs", title: "My packs", icon: FolderHeart },
  { tab: "about", title: "The little details", icon: Heart },
] as const;

export default function App() {
  const [fonts] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSans_800ExtraBold,
  });
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {fonts ? (
        <Studio />
      ) : (
        <View style={s.loading}>
          <ActivityIndicator color={C.purple} />
        </View>
      )}
    </SafeAreaProvider>
  );
}
function Studio() {
  const { width } = useWindowDimensions();
  const wide = width >= 850;
  const [library, setLibrary] = useState<Library>({ version: 1, packs: [] });
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<Tab>("workshop");
  const [packId, setPackId] = useState<string | null>(null);
  const [design, setDesign] = useState<StickerDesign | null>(null);
  const [originalSource, setOriginalSource] = useState("");
  const [video, setVideo] = useState<Media | null>(null);
  const [frameTime, setFrameTime] = useState(0);
  const [busy, setBusy] = useState("");
  const busyRef = useRef(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [packModal, setPackModal] = useState(false);
  const [packName, setPackName] = useState("");
  const [purpose, setPurpose] = useState<"new" | "save">("new");
  const [saveTo, setSaveTo] = useState("");
  const [selectedSticker, setSelectedSticker] = useState<Sticker | null>(null);
  const captureView = useRef<View>(null);
  const activePack = library.packs.find((p) => p.id === packId);
  const total = library.packs.reduce((n, p) => n + p.stickers.length, 0);
  const isEditing = design !== null;

  async function boot() {
    setReady(false);
    setLoadError("");
    try {
      setLibrary((await loadLibrary()) || { version: 1, packs: [] });
      setReady(true);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Your library could not be loaded.",
      );
    }
  }
  useEffect(() => {
    boot();
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);
  useEffect(
    () => () => {
      if (Platform.OS === "web" && video?.uri.startsWith("blob:"))
        URL.revokeObjectURL(video.uri);
    },
    [video?.uri],
  );
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (busyRef.current) return true;
        if (isEditing) {
          leaveEditor();
          return true;
        }
        if (packId) {
          setPackId(null);
          return true;
        }
        if (tab !== "workshop") {
          setTab("workshop");
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [isEditing, packId, tab]);
  function announce(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4000);
  }
  async function run(label: string, action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(label);
    try {
      await action();
    } catch (e) {
      setDialog({
        title: "A little help needed",
        body:
          e instanceof Error
            ? e.message
            : "Something went wrong. Please try again.",
      });
    } finally {
      busyRef.current = false;
      setBusy("");
    }
  }
  async function commit(packs: Pack[]) {
    const next: Library = { version: 1, packs };
    await saveLibrary(next);
    setLibrary(next);
  }
  function update(patch: Partial<StickerDesign>) {
    setDesign((d) => (d ? { ...d, ...patch } : null));
  }
  function sample(mood: Mood) {
    setDesign({
      ...defaultDesign("", mood),
      caption:
        mood === "love"
          ? "my whole heart"
          : mood === "hype"
            ? "LET’S GOOO"
            : "you did that!",
    });
    setOriginalSource("");
    setVideo(null);
  }
  async function importMedia(kind: Media["kind"]) {
    await run("Opening your camera roll…", async () => {
      const media = await pickMedia(kind);
      if (!media) return;
      if (kind === "video") {
        const source = await videoFrame(media.uri, 0);
        setVideo(media);
        setFrameTime(0);
        setOriginalSource(source);
        setDesign(defaultDesign(source));
      } else {
        setVideo(null);
        setOriginalSource(media.uri);
        setDesign(defaultDesign(media.uri));
      }
    });
  }
  function leaveEditor() {
    setDialog({
      title: "Leave this sticker?",
      body: "Your unsaved changes will be lost. Stickers already in your packs are safe.",
      label: "Leave editor",
      action: () => {
        setDesign(null);
        setVideo(null);
      },
    });
  }
  async function changeFrame(time: number) {
    if (!video) return;
    await run("Finding your moment…", async () => {
      const source = await videoFrame(video.uri, time);
      setFrameTime(time);
      setOriginalSource(source);
      update({ source, shape: "rounded", zoom: 1, x: 0, y: 0 });
    });
  }
  async function cutout() {
    if (!design) return;
    if (design.source !== originalSource) {
      update({ source: originalSource, shape: "rounded" });
      return;
    }
    await run("Cutting out your favorite…", async () => {
      const source = await removeBackground(originalSource);
      update({ source, shape: "cutout" });
      announce("Background removed. Looking good!");
    });
  }
  function askSave() {
    setSaveTo(
      activePack && activePack.stickers.length < 30
        ? activePack.id
        : library.packs.find((p) => p.stickers.length < 30)?.id || "",
    );
    setPurpose("save");
    setPackName("");
    setPackModal(true);
  }
  async function saveCurrent() {
    if (!design) return;
    await run("Making your sticker…", async () => {
      const target = saveTo
        ? library.packs.find((p) => p.id === saveTo)
        : createPack(packName.trim() || "My favorites");
      if (!target) throw new Error("Choose a pack for your sticker.");
      const sticker = await renderSticker(design, captureView);
      try {
        const updated = addSticker(target, sticker);
        await commit(
          library.packs.some((p) => p.id === target.id)
            ? library.packs.map((p) => (p.id === target.id ? updated : p))
            : [updated, ...library.packs],
        );
      } catch (error) {
        await discardSticker(sticker).catch(() => {});
        throw error;
      }
      setPackModal(false);
      setDesign(null);
      setVideo(null);
      setTab("packs");
      setPackId(target.id);
      announce("A new favorite, saved to your pack.");
    });
  }
  function newPack() {
    setPurpose("new");
    setPackName("");
    setPackModal(true);
  }
  async function makePack() {
    await run("Creating your pack…", async () => {
      const pack = createPack(packName);
      await commit([pack, ...library.packs]);
      setPackModal(false);
      setTab("packs");
      setPackId(pack.id);
      announce("Your new pack is ready for some favorites.");
    });
  }
  function deletePack(pack: Pack) {
    setDialog({
      title: `Delete “${pack.name}”?`,
      body: "This removes the pack from your sticker shelf. A copy already added to WhatsApp stays there.",
      label: "Delete pack",
      action: () => {
        run("Deleting pack…", async () => {
          await commit(library.packs.filter((p) => p.id !== pack.id));
          setPackId(null);
          announce("Pack deleted.");
        });
      },
    });
  }
  function deleteSticker(sticker: Sticker) {
    if (!activePack) return;
    const pack = activePack;
    setDialog({
      title: "Remove this sticker?",
      body: "It will be removed from this pack on this device.",
      label: "Remove sticker",
      action: () => {
        run("Removing sticker…", async () => {
          await commit(
            library.packs.map((p) =>
              p.id === pack.id
                ? {
                    ...p,
                    stickers: p.stickers.filter((st) => st.id !== sticker.id),
                    updatedAt: Date.now(),
                  }
                : p,
            ),
          );
          setSelectedSticker(null);
          announce("Sticker removed.");
        });
      },
    });
  }
  async function exportPack(pack: Pack) {
    await run("Preparing for WhatsApp…", async () => {
      await exportWhatsApp(pack);
      announce("WhatsApp opened. Confirm the pack there to add it.");
    });
  }
  function navigate(next: Tab) {
    if (design) leaveEditor();
    else {
      setTab(next);
      setPackId(null);
    }
  }

  function packCard(pack: Pack) {
    return (
      <Pressable
        key={pack.id}
        accessibilityRole="button"
        accessibilityLabel={`Open ${pack.name}`}
        onPress={() => {
          setPackId(pack.id);
          setTab("packs");
        }}
        style={({ pressed }) => [
          s.packCard,
          { width: wide ? "31.8%" : "100%" },
          pressed && { opacity: 0.8 },
        ]}
      >
        <View style={[s.packPreview, { backgroundColor: pack.color + "16" }]}>
          {pack.stickers.length ? (
            pack.stickers.slice(0, 3).map((sticker, index) => (
              <View
                key={sticker.id}
                style={{
                  transform: [{ rotate: `${(index - 1) * 9}deg` }],
                  marginHorizontal: -11,
                  marginTop: index === 1 ? -15 : 5,
                }}
              >
                <StickerImage sticker={sticker} size={105} />
              </View>
            ))
          ) : (
            <View style={{ alignItems: "center", paddingBottom: 12 }}>
              <FolderHeart size={36} color={pack.color} strokeWidth={1.4} />
              <T style={[s.meta, { marginTop: 10 }]}>
                A little space for your favorites
              </T>
            </View>
          )}
          <View style={s.packTag}>
            <T
              style={{
                fontSize: 9,
                color: C.muted,
                fontFamily: "DMSans_600SemiBold",
                letterSpacing: 0.5,
              }}
            >
              {pack.stickers.length >= 3
                ? "READY FOR WHATSAPP"
                : "IN THE MAKING"}
            </T>
          </View>
        </View>
        <View style={s.packInfo}>
          <View>
            <T
              style={{
                fontFamily: "DMSans_600SemiBold",
                fontSize: 14,
                marginBottom: 4,
              }}
            >
              {pack.name}
            </T>
            <T style={s.meta}>{pack.stickers.length} / 30 stickers</T>
          </View>
          <ChevronRight size={18} color={C.muted} />
        </View>
      </Pressable>
    );
  }

  function renderPacks() {
    return activePack ? (
      <>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setPackId(null);
            setSelectedSticker(null);
          }}
          style={[s.row, { marginBottom: 22, alignSelf: "flex-start" }]}
        >
          <ArrowLeft size={17} color={C.muted} />
          <T style={{ color: C.muted, fontSize: 13 }}>All packs</T>
        </Pressable>
        <View style={s.heading}>
          <View style={{ flex: 1 }}>
            <T style={s.eyebrow}>YOUR PERSONAL COLLECTION</T>
            <T style={s.title}>{activePack.name}</T>
            <T style={s.sub}>
              {activePack.stickers.length} / 30 stickers · Made by you, for the
              group chat.
            </T>
          </View>
          <IconButton
            label="Delete pack"
            icon={Trash2}
            onPress={() => deletePack(activePack)}
          />
        </View>
        <View
          style={[
            s.whatsappBanner,
            !wide && { flexDirection: "column", alignItems: "stretch" },
          ]}
        >
          <View style={[s.row, { flex: 1 }]}>
            <View style={s.whatsappIcon}>
              <MessageCircle size={23} color="#43866C" />
            </View>
            <View style={{ flex: 1 }}>
              <T style={{ fontFamily: "DMSans_600SemiBold", fontSize: 14 }}>
                {activePack.stickers.length >= 3
                  ? "Ready for the group chat"
                  : "Good things come in threes"}
              </T>
              <T style={[s.meta, { marginTop: 4, fontSize: 12 }]}>
                {activePack.stickers.length >= 3
                  ? "512 × 512 · Optimized for WhatsApp"
                  : `Add ${3 - activePack.stickers.length} more sticker${activePack.stickers.length === 2 ? "" : "s"} to add this pack to WhatsApp.`}
              </T>
            </View>
          </View>
          <Button
            label="Add to WhatsApp"
            icon={MessageCircle}
            disabled={activePack.stickers.length < 3}
            onPress={() => exportPack(activePack)}
          />
        </View>
        {Platform.OS === "web" && (
          <View style={s.note}>
            <CircleHelp size={14} color={C.muted} />
            <T style={{ fontSize: 12, color: C.muted, flex: 1 }}>
              Browser preview: create and download stickers here. Adding a pack
              to WhatsApp requires the native app.
            </T>
          </View>
        )}
        <View style={[s.stickerGrid, !wide && { gap: 10 }]}>
          {activePack.stickers.map((sticker) => (
            <Pressable
              key={sticker.id}
              accessibilityRole="button"
              accessibilityLabel={`View sticker ${sticker.caption || sticker.id}`}
              onPress={() => setSelectedSticker(sticker)}
              style={[s.stickerTile, { width: wide ? 180 : (width - 58) / 2 }]}
            >
              <StickerImage
                sticker={sticker}
                size={wide ? 150 : (width - 86) / 2}
              />
              <T numberOfLines={1} style={[s.meta, { marginTop: 5 }]}>
                {sticker.caption || "Your little masterpiece"}
              </T>
            </Pressable>
          ))}
          {activePack.stickers.length < 30 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add sticker to pack"
              onPress={() => importMedia("photo")}
              style={[
                s.addTile,
                {
                  width: wide ? 180 : (width - 58) / 2,
                  minHeight: wide ? 202 : (width - 58) / 2 + 34,
                },
              ]}
            >
              <View style={[s.shelfIcon, { width: 43, height: 43 }]}>
                <Plus color={C.purple} size={20} />
              </View>
              <T style={{ fontSize: 12, color: C.purple, marginTop: 10 }}>
                Add a little favorite
              </T>
            </Pressable>
          )}
        </View>
        <View style={[s.row, { marginTop: 24, flexWrap: "wrap" }]}>
          <Button
            secondary
            small
            label="Use a video frame"
            icon={Clapperboard}
            onPress={() => importMedia("video")}
          />
          <Button
            secondary
            small
            label="Try a demo sticker"
            icon={Sparkles}
            onPress={() => sample("love")}
          />
        </View>
      </>
    ) : (
      <>
        <View style={s.heading}>
          <View style={{ flex: 1 }}>
            <T style={s.eyebrow}>YOUR FAVORITES, ALL TOGETHER</T>
            <T style={s.title}>Your sticker shelf</T>
            <T style={s.sub}>
              {library.packs.length} collections. A whole lot of personality.
            </T>
          </View>
          <Button small label="New pack" icon={Plus} onPress={newPack} />
        </View>
        {library.packs.length ? (
          <View style={[s.packGrid, !wide && { flexDirection: "column" }]}>
            {library.packs.map(packCard)}
          </View>
        ) : (
          <View style={s.largeEmpty}>
            <FolderHeart size={52} color="#B7A0D5" strokeWidth={1.2} />
            <T
              style={{
                fontSize: 24,
                fontFamily: "DMSans_700Bold",
                marginTop: 22,
                textAlign: "center",
              }}
            >
              Your next favorite starts here.
            </T>
            <T
              style={[
                s.sub,
                { textAlign: "center", maxWidth: 330, marginTop: 10 },
              ]}
            >
              Make a pack for your bias, your favorite era, or just those very
              specific feelings.
            </T>
            <View style={{ marginTop: 23 }}>
              <Button
                label="Create your first pack"
                icon={Plus}
                onPress={newPack}
              />
            </View>
          </View>
        )}
      </>
    );
  }

  // Keep photo processing, local storage, and system backups clear in the privacy explanation.
  function renderAbout() {
    return (
      <View style={{ maxWidth: 710 }}>
        <T style={s.eyebrow}>A LITTLE STUDIO, BIG FEELINGS</T>
        <T style={s.title}>Meet Bias Studio.</T>
        <T style={[s.sub, { fontSize: 16, lineHeight: 26 }]}>
          A private place to turn your favorite idol moments into something you
          can send.
        </T>
        {[
          [
            "Start with a moment",
            "Choose a photo or a video from your own library. For videos, find your favorite frame and turn it into a still sticker.",
          ],
          [
            "Add your personality",
            "Crop, add a caption, choose a frame, or remove a person’s background in the native app. Background removal happens on your device.",
          ],
          [
            "Make a pack, share a feeling",
            "Save 3–30 stickers in a pack, then tap Add to WhatsApp in the native app. Finish adding the pack inside WhatsApp.",
          ],
          [
            "Your camera roll stays yours",
            "No sign-up, photo uploads, or public feed. Packs are stored locally. Your phone’s system backups follow its own settings. Uninstalling the app or clearing browser data removes your local library.",
          ],
          [
            "A note about your favorites",
            "Use images and clips you have permission to use. Bias Studio is a fan creation tool and is not affiliated with artists or WhatsApp. The demo characters are original illustrations.",
          ],
        ].map(([title, body], i) => (
          <View key={title} style={s.aboutRow}>
            <View style={s.sectionNumber}>
              <T style={s.eyebrow}>0{i + 1}</T>
            </View>
            <View style={{ flex: 1 }}>
              <T style={{ fontFamily: "DMSans_600SemiBold", fontSize: 17 }}>
                {title}
              </T>
              <T
                style={[s.sub, { marginTop: 6, fontSize: 13, lineHeight: 22 }]}
              >
                {body}
              </T>
            </View>
          </View>
        ))}
        <View style={[s.note, { marginTop: 24 }]}>
          <CircleHelp size={18} color={C.purple} />
          <T style={{ flex: 1, color: C.muted, fontSize: 12, lineHeight: 19 }}>
            First version: still stickers from photos and video frames. Animated
            stickers, cloud backup, and community packs are future features.
          </T>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.header}>
        <View
          style={[
            s.headerInner,
            !wide && { paddingHorizontal: 22, height: 70 },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bias Studio home"
            onPress={() => navigate("workshop")}
            style={s.logo}
          >
            <View style={s.logoMark}>
              <Layers size={22} color="white" strokeWidth={1.7} />
            </View>
            <T style={s.logoText}>
              bias<T style={{ fontFamily: "DMSans_400Regular" }}>studio</T>
              <T style={{ color: C.purple }}>.</T>
            </T>
          </Pressable>
          {wide && (
            <View style={s.nav}>
              {NAV.map((item) => (
                <Pressable
                  key={item.tab}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: !design && tab === item.tab }}
                  onPress={() => navigate(item.tab)}
                  style={[
                    s.navItem,
                    !design && tab === item.tab && s.navSelected,
                  ]}
                >
                  <item.icon
                    size={15}
                    strokeWidth={1.8}
                    color={!design && tab === item.tab ? C.purple : C.muted}
                  />
                  <T
                    style={[
                      s.navText,
                      !design && tab === item.tab && { color: C.purple },
                    ]}
                  >
                    {item.title}
                  </T>
                </Pressable>
              ))}
            </View>
          )}
          <View style={s.avatar}>
            <Heart size={15} color="#B095CA" strokeWidth={1.5} />
          </View>
        </View>
      </View>
      {!ready ? (
        <View style={s.loading}>
          {loadError ? (
            <>
              <CircleHelp color={C.purple} size={28} />
              <T
                style={[
                  s.sub,
                  { textAlign: "center", maxWidth: 320, marginVertical: 20 },
                ]}
              >
                {loadError}
              </T>
              <Button label="Try loading again" onPress={boot} />
            </>
          ) : (
            <ActivityIndicator color={C.purple} />
          )}
        </View>
      ) : (
        <ScrollView
          key={design ? "editor" : `${tab}-${packId || ""}`}
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              s.content,
              !wide && {
                paddingHorizontal: 24,
                paddingTop: 26,
                paddingBottom: 28,
              },
            ]}
          >
            {design ? (
              <Editor
                design={design}
                update={update}
                width={width}
                wide={wide}
                captureView={captureView}
                video={video}
                frameTime={frameTime}
                onFrame={changeFrame}
                originalSource={originalSource}
                onCutout={cutout}
                onImport={() => importMedia("photo")}
                onBack={leaveEditor}
                onSave={askSave}
              />
            ) : tab === "workshop" ? (
              <Home
                wide={wide}
                packs={library.packs}
                total={total}
                onPhoto={() => importMedia("photo")}
                onVideo={() => importMedia("video")}
                onNewPack={newPack}
                onPacks={() => navigate("packs")}
                onSample={sample}
                renderPack={packCard}
              />
            ) : tab === "packs" ? (
              renderPacks()
            ) : (
              renderAbout()
            )}
          </View>
        </ScrollView>
      )}
      {!wide && !design && (
        <SafeAreaView edges={["bottom"]} style={s.bottomNav}>
          <View style={s.bottomNavInner}>
            {NAV.map((item) => (
              <Pressable
                key={item.tab}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === item.tab }}
                onPress={() => navigate(item.tab)}
                style={s.bottomNavItem}
              >
                <item.icon
                  size={20}
                  color={tab === item.tab ? C.purple : "#A99AB4"}
                  strokeWidth={1.7}
                />
                <T
                  style={{
                    fontSize: 10,
                    marginTop: 4,
                    color: tab === item.tab ? C.purple : C.muted,
                  }}
                >
                  {item.tab === "about" ? "About" : item.title}
                </T>
              </Pressable>
            ))}
          </View>
        </SafeAreaView>
      )}
      {!!toast && (
        <View accessibilityLiveRegion="polite" style={s.toast}>
          <Check size={16} color="#BEDCCB" />
          <T style={{ color: "white", fontSize: 12, flex: 1 }}>{toast}</T>
        </View>
      )}
      <Modal
        visible={packModal}
        transparent
        animationType="fade"
        onRequestClose={() => !busy && setPackModal(false)}
      >
        <View style={s.shade}>
          <View style={s.modal}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View
                style={[
                  s.row,
                  { justifyContent: "space-between", marginBottom: 18 },
                ]}
              >
                <View style={s.shelfIcon}>
                  <FolderHeart size={24} color={C.purple} />
                </View>
                <IconButton
                  label="Close pack dialog"
                  icon={X}
                  onPress={() => !busy && setPackModal(false)}
                />
              </View>
              <T style={s.modalTitle}>
                {purpose === "save"
                  ? "A home for your sticker."
                  : "Make room for a new favorite."}
              </T>
              <T style={[s.sub, { marginTop: 8, marginBottom: 24 }]}>
                {purpose === "save"
                  ? "Choose a pack, or start a fresh little collection."
                  : "Your bias, your favorite era, your very specific mood."}
              </T>
              {purpose === "save" &&
                library.packs
                  .filter((p) => p.stickers.length < 30)
                  .map((pack) => (
                    <Pressable
                      key={pack.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: saveTo === pack.id }}
                      onPress={() => setSaveTo(pack.id)}
                      style={[
                        s.packChoice,
                        saveTo === pack.id && {
                          borderColor: C.purple,
                          backgroundColor: "#FAF7FE",
                        },
                      ]}
                    >
                      <FolderHeart size={18} color={C.purple} />
                      <T style={{ flex: 1, fontSize: 13 }}>{pack.name}</T>
                      <T style={s.meta}>{pack.stickers.length}/30</T>
                      {saveTo === pack.id && (
                        <Check size={16} color={C.purple} />
                      )}
                    </Pressable>
                  ))}
              {purpose === "save" && (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: !saveTo }}
                  onPress={() => setSaveTo("")}
                  style={[
                    s.packChoice,
                    !saveTo && {
                      borderColor: C.purple,
                      backgroundColor: "#FAF7FE",
                    },
                  ]}
                >
                  <Plus size={17} color={C.purple} />
                  <T style={{ flex: 1, fontSize: 13 }}>Start a new pack</T>
                  {!saveTo && <Check size={16} color={C.purple} />}
                </Pressable>
              )}
              {(purpose === "new" || !saveTo) && (
                <>
                  <T
                    style={[
                      s.label,
                      { marginTop: purpose === "save" ? 20 : 0 },
                    ]}
                  >
                    GIVE IT A NAME
                  </T>
                  <TextInput
                    accessibilityLabel="Pack name"
                    maxLength={64}
                    value={packName}
                    onChangeText={setPackName}
                    placeholder={
                      purpose === "save"
                        ? "My favorites"
                        : "e.g. My comfort person"
                    }
                    placeholderTextColor="#B1A5BC"
                    style={s.input}
                    onSubmitEditing={
                      purpose === "save" ? saveCurrent : makePack
                    }
                  />
                </>
              )}
              <View style={{ marginTop: 24 }}>
                <Button
                  label={purpose === "save" ? "Save to pack" : "Create pack"}
                  icon={purpose === "save" ? Check : Plus}
                  disabled={!!busy || (purpose === "new" && !packName.trim())}
                  onPress={purpose === "save" ? saveCurrent : makePack}
                />
              </View>
              <T
                style={{
                  fontSize: 10,
                  textAlign: "center",
                  color: C.muted,
                  marginTop: 15,
                }}
              >
                Your packs are saved on this device.
              </T>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        visible={!!selectedSticker}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedSticker(null)}
      >
        <View style={s.shade}>
          <View style={s.modal}>
            <View style={{ alignSelf: "flex-end" }}>
              <IconButton
                label="Close sticker"
                icon={X}
                onPress={() => setSelectedSticker(null)}
              />
            </View>
            {selectedSticker && (
              <>
                <View style={{ alignSelf: "center" }}>
                  <StickerImage sticker={selectedSticker} size={240} />
                </View>
                <T
                  style={{
                    textAlign: "center",
                    fontFamily: "DMSans_700Bold",
                    fontSize: 19,
                  }}
                >
                  {selectedSticker.caption || "Your little masterpiece"}
                </T>
                <T
                  style={[
                    s.meta,
                    { textAlign: "center", marginTop: 8, marginBottom: 25 },
                  ]}
                >
                  512 × 512 · {(selectedSticker.bytes / 1024).toFixed(1)} KB ·
                  WebP
                </T>
                <Button
                  label={
                    Platform.OS === "web" ? "Download sticker" : "Share sticker"
                  }
                  icon={ArrowDownToLine}
                  onPress={() =>
                    run("Getting your sticker…", async () => {
                      await shareSticker(selectedSticker);
                    })
                  }
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => deleteSticker(selectedSticker)}
                  style={{ alignSelf: "center", marginTop: 20 }}
                >
                  <T style={{ color: "#B77385", fontSize: 12 }}>
                    Remove from pack
                  </T>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
      <Modal
        visible={!!dialog}
        transparent
        animationType="fade"
        onRequestClose={() => setDialog(null)}
      >
        <View style={s.shade}>
          <View style={s.modal}>
            <T style={s.modalTitle}>{dialog?.title}</T>
            <T
              style={[
                s.sub,
                { lineHeight: 23, marginTop: 12, marginBottom: 24 },
              ]}
            >
              {dialog?.body}
            </T>
            <View style={{ gap: 10 }}>
              {dialog?.action && (
                <Button
                  label={dialog.label}
                  onPress={() => {
                    const action = dialog.action;
                    setDialog(null);
                    action?.();
                  }}
                />
              )}
              <Button
                secondary={!!dialog?.action}
                label={dialog?.action ? "Keep creating" : "Got it"}
                onPress={() => setDialog(null)}
              />
            </View>
          </View>
        </View>
      </Modal>
      {!!busy && (
        <View style={s.busy}>
          <View style={s.busyCard}>
            <ActivityIndicator color={C.purple} />
            <T style={{ marginTop: 16, fontSize: 13 }}>{busy}</T>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

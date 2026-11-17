import React, { useEffect, useRef, useState } from "react";
import { Modal, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  BookmarkPlus,
  Clapperboard,
  ImagePlus,
  Library,
  Undo2,
} from "lucide-react-native";
import {
  Action,
  Chip,
  Field,
  Journey,
  K,
  ReactionTile,
  Shell,
  v,
} from "../CreatorUI";
import { Art, T } from "../ui";
import { useWorkspace } from "../WorkspaceProvider";
import {
  appendItems,
  applyStyle,
  captions,
  duplicate,
  reaction,
  title,
} from "../workspace";
import { defaultDesign, StickerDesign } from "../domain";
import { Media, pickMany, videoFrame } from "../media";
import { StyleControls } from "../StyleControls";
import Slider from "../Range";

type Frame = { uri: string; seconds: number };
export function PackScreen() {
  const { id, import: importKind } = useLocalSearchParams<{
    id: string;
    import?: string;
  }>();
  const store = useWorkspace();
  const pack = store.data.collections.find((p) => p.id === id);
  const [selected, setSelected] = useState<string[]>([]);
  const [styling, setStyling] = useState(false);
  const [details, setDetails] = useState(false);
  const [tags, setTags] = useState(false);
  const [video, setVideo] = useState<Media | null>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [candidateFrames, setCandidateFrames] = useState<Frame[]>([]);
  const started = useRef(false);
  const ids = selected.length ? selected : pack?.items.map((i) => i.id) || [];
  const first = pack?.items.find((i) => ids.includes(i.id));
  useEffect(
    () => () => {
      if (video?.uri.startsWith("blob:")) URL.revokeObjectURL(video.uri);
    },
    [video?.uri],
  );
  async function importMedia(kind: "photo" | "video") {
    if (!pack) return;
    await store.run(
      kind === "photo"
        ? "Importing your photos…"
        : "Finding moments in your video…",
      async () => {
        const remaining = 30 - pack.items.length;
        if (remaining <= 0)
          throw new Error(
            "This pack has 30 reactions. Start another pack for more.",
          );
        const media = await pickMany(kind, remaining);
        if (!media.length) return;
        if (kind === "photo") {
          const items = media.map((m) =>
            reaction(
              { ...defaultDesign(m.uri), originalSource: m.uri },
              { name: m.name || "Photo" },
            ),
          );
          store.updatePack(id, (p) => appendItems(p, items));
          setSelected(items.map((i) => i.id));
        } else {
          const clip = media[0];
          if (clip.duration <= 0 || clip.duration > 86400)
            throw new Error(
              "This video has no readable duration. Try another clip.",
            );
          const candidates: Frame[] = [];
          for (let i = 0; i < 5; i++) {
            const seconds =
              Math.round(((Math.max(0, clip.duration - 0.1) * i) / 4) * 10) /
              10;
            if (candidates.some((f) => f.seconds === seconds)) continue;
            candidates.push({
              uri: await videoFrame(clip.uri, seconds),
              seconds,
            });
          }
          setVideo(clip);
          setFrame(candidates[0]);
          setCandidateFrames(candidates);
          setFrames([]);
        }
      },
    );
  }
  const importRef = useRef(importMedia);
  importRef.current = importMedia;
  useEffect(() => {
    if (!started.current && pack && importKind) {
      started.current = true;
      // Consume the import intent so reopening this draft never reopens the picker.
      router.setParams({ import: undefined });
      void importRef.current(importKind === "video" ? "video" : "photo");
    }
  }, [importKind, pack]);
  if (!pack)
    return (
      <Shell>
        <T style={v.title}>Pack not found</T>
        <Action
          label="Back to packs"
          onPress={() => router.replace("/packs")}
        />
      </Shell>
    );
  function batch(patch: Partial<StickerDesign>) {
    if (!pack || !first) return;
    const style = patch;
    store.updatePack(id, (p) => applyStyle(p, ids, style));
  }
  function saveAssets() {
    const items = pack!.items.filter((i) => ids.includes(i.id));
    store.change((old) => ({
      ...old,
      assets: [
        ...old.assets.filter((a) => !items.some((i) => i.id === a.id)),
        ...JSON.parse(JSON.stringify(items)),
      ],
    }));
    store.notice(
      `${items.length} editable reactions saved to your library. Reuse them in your next pack.`,
    );
  }
  function addFrames() {
    if (!video) return;
    const items = frames.map((f) =>
      reaction(
        { ...defaultDesign(f.uri), originalSource: f.uri },
        { name: video.name || "Video", seconds: f.seconds },
      ),
    );
    store.run("Adding selected moments…", async () => {
      store.updatePack(id, (p) => appendItems(p, items));
      setSelected(items.map((i) => i.id));
      setVideo(null);
      setFrames([]);
      setFrame(null);
    });
  }
  function move(itemId: string, offset: number) {
    store.updatePack(id, (p) => {
      const items = [...p.items];
      const from = items.findIndex((i) => i.id === itemId);
      const to = from + offset;
      if (to < 0 || to >= items.length) return p;
      [items[from], items[to]] = [items[to], items[from]];
      return { ...p, items };
    });
  }
  return (
    <Shell back={() => router.push("/packs")}>
      <Journey step={styling ? 1 : 0} />
      <View style={{ gap: 8 }}>
        <T style={v.eyebrow}>
          {pack.items.length} / 30 REACTIONS · PRIVATE DRAFT
        </T>
        <T style={v.title}>{title(pack)}</T>
        <T style={v.sub}>
          {pack.items.length
            ? "One collection. Every kind of feeling. Select reactions to style together, or refine one at a time."
            : "Start with a handful of moments. You can name this pack whenever it feels right."}
        </T>
      </View>
      <View style={v.wrap}>
        <Action
          secondary
          label="Add photos"
          icon={ImagePlus}
          onPress={() => importMedia("photo")}
        />
        <Action
          secondary
          label="Video frames"
          icon={Clapperboard}
          onPress={() => importMedia("video")}
        />
        <Action
          secondary
          label="Reuse library"
          icon={Library}
          onPress={() =>
            router.push({ pathname: "/library", params: { to: id } })
          }
        />
      </View>
      {!pack.items.length && (
        <View style={[v.card, { backgroundColor: K.lavender }]}>
          <T style={v.section}>A little pack, a whole personality</T>
          <T style={v.sub}>
            Pick multiple photos, keep several moments from a video, or start
            with saved reactions. Still images only.
          </T>
          <Action
            secondary
            label="Add demo reactions"
            onPress={() => {
              const items = (["love", "hype", "happy"] as const).map((m, i) =>
                reaction({ ...defaultDesign("", m), caption: captions[i] }),
              );
              store.updatePack(id, (p) => appendItems(p, items));
            }}
          />
        </View>
      )}
      {!!pack.items.length && (
        <>
          <View
            style={[
              v.row,
              { justifyContent: "space-between", flexWrap: "wrap" },
            ]}
          >
            <T style={v.section}>
              {selected.length
                ? `${selected.length} selected`
                : "The whole collection"}
            </T>
            <Chip
              label={selected.length ? "Clear selection" : "Select all"}
              onPress={() =>
                setSelected(selected.length ? [] : pack.items.map((i) => i.id))
              }
            />
          </View>
          <View style={v.wrap}>
            {pack.items.map((item, i) => (
              <ReactionTile
                key={item.id}
                item={item}
                selected={selected.includes(item.id)}
                label={`Select reaction ${i + 1}`}
                onPress={() =>
                  setSelected((old) =>
                    old.includes(item.id)
                      ? old.filter((x) => x !== item.id)
                      : [...old, item.id],
                  )
                }
              >
                <Action
                  secondary
                  label={`Refine ${i + 1}`}
                  onPress={() =>
                    router.push({
                      pathname: "/edit/[id]",
                      params: { id, item: item.id },
                    })
                  }
                />
                <View style={[v.row, { justifyContent: "center", gap: 4 }]}>
                  <Action
                    secondary
                    label={`← ${i + 1}`}
                    accessibilityLabel={`Move reaction ${i + 1} earlier`}
                    disabled={i === 0}
                    onPress={() => move(item.id, -1)}
                  />
                  <Action
                    secondary
                    label={`${i + 1} →`}
                    accessibilityLabel={`Move reaction ${i + 1} later`}
                    disabled={i === pack.items.length - 1}
                    onPress={() => move(item.id, 1)}
                  />
                </View>
              </ReactionTile>
            ))}
          </View>
          <View style={v.card}>
            <T style={v.section}>
              {selected.length
                ? `${ids.length} selected reactions`
                : `All ${ids.length} reactions`}
            </T>
            <Action
              label={
                styling
                  ? "Close pack styling"
                  : `Style ${selected.length ? "selected" : "whole pack"}`
              }
              onPress={() => setStyling(!styling)}
            />
            {styling && first && (
              <>
                <View style={{ alignItems: "center" }}>
                  <Art design={first.design} size={180} />
                </View>
                <T style={v.small}>
                  Changes apply to {ids.length} reactions. Captions and
                  individual crops stay intact. Refine a sticker afterwards to
                  override its style.
                </T>
                <StyleControls design={first.design} onChange={batch} />
              </>
            )}
            <View style={v.wrap}>
              <Action
                secondary
                label="Save to library"
                icon={BookmarkPlus}
                onPress={saveAssets}
              />
              <Action
                secondary
                label="Duplicate selected"
                onPress={() =>
                  store.run("Duplicating reactions…", async () =>
                    store.updatePack(id, (p) =>
                      appendItems(
                        p,
                        p.items
                          .filter((i) => ids.includes(i.id))
                          .map(duplicate),
                      ),
                    ),
                  )
                }
              />
            </View>
            <Action
              secondary
              label={tags ? "Hide organization" : "Organize selected reactions"}
              onPress={() => setTags(!tags)}
            />
            {tags && (
              <>
                <T style={v.small}>
                  Optional tags apply to {ids.length} reactions. Save to library
                  again after updating tags.
                </T>
                {(["fandom", "member", "era", "emotion"] as const).map(
                  (key) => (
                    <Field
                      key={key}
                      label={
                        {
                          fandom: "Fandom",
                          member: "Member / character",
                          era: "Era / event",
                          emotion: "Emotion",
                        }[key]
                      }
                      maxLength={80}
                      value={first?.tags[key] || ""}
                      onChange={(value) =>
                        store.updatePack(id, (p) => ({
                          ...p,
                          items: p.items.map((item) =>
                            ids.includes(item.id)
                              ? {
                                  ...item,
                                  tags: { ...item.tags, [key]: value },
                                }
                              : item,
                          ),
                        }))
                      }
                    />
                  ),
                )}
              </>
            )}
            <View style={v.wrap}>
              <Action
                secondary
                label="Undo"
                icon={Undo2}
                disabled={!store.canUndo}
                onPress={store.undo}
              />
              {!!selected.length && (
                <Action
                  secondary
                  label="Remove selected"
                  onPress={() => {
                    store.updatePack(id, (p) => ({
                      ...p,
                      items: p.items.filter((i) => !selected.includes(i.id)),
                    }));
                    setSelected([]);
                  }}
                />
              )}
            </View>
          </View>
        </>
      )}
      <Action
        secondary
        label={details ? "Close collection details" : "Name & creator credit"}
        onPress={() => setDetails(!details)}
      />
      {details && (
        <View style={v.card}>
          <Field
            label="Pack name"
            placeholder="e.g. Encore energy"
            value={pack.name}
            onChange={(name) => store.updatePack(id, (p) => ({ ...p, name }))}
          />
          <Field
            label="Creator credit"
            placeholder="Your creator name or handle"
            value={pack.publisher}
            onChange={(publisher) =>
              store.updatePack(id, (p) => ({ ...p, publisher }))
            }
          />
          <T selectable style={v.small}>
            Collection {pack.id}
            {pack.origin
              ? ` · Remixed from ${pack.origin.creator || "a Bias Studio creator"}`
              : ""}
          </T>
        </View>
      )}
      <Action
        label="Preview in chat"
        disabled={!pack.items.length}
        onPress={() => router.push(`/preview/${id}`)}
      />
      <Modal
        visible={!!video}
        animationType="slide"
        onRequestClose={() => setVideo(null)}
      >
        <View style={{ flex: 1, backgroundColor: K.paper, paddingTop: 32 }}>
          <ScrollView contentContainerStyle={v.page}>
            <T style={v.eyebrow}>SELECT YOUR MOMENTS</T>
            <T style={v.title}>Every frame, a feeling.</T>
            <T style={v.sub}>
              Select several frames below, or scrub to an exact moment. These
              become still stickers.
            </T>
            {frame && (
              <View style={{ alignItems: "center" }}>
                <Art
                  design={{ ...defaultDesign(frame.uri), decoration: "none" }}
                  size={260}
                />
                <T style={v.small}>
                  {frame.seconds.toFixed(1)}s / {video?.duration.toFixed(1)}s
                </T>
              </View>
            )}
            {video && (
              <Slider
                accessibilityLabel="Video frame time"
                minimumValue={0}
                maximumValue={Math.max(0.1, video.duration - 0.1)}
                step={0.1}
                value={frame?.seconds || 0}
                onSlidingComplete={(seconds) =>
                  store.run("Finding your frame…", async () =>
                    setFrame({
                      seconds,
                      uri: await videoFrame(video.uri, seconds),
                    }),
                  )
                }
              />
            )}
            <View style={v.wrap}>
              {candidateFrames.map((f) => (
                <Chip
                  key={f.seconds}
                  label={`Frame ${f.seconds.toFixed(1)}s`}
                  selected={frames.some((x) => x.seconds === f.seconds)}
                  onPress={() => {
                    setFrame(f);
                    setFrames((old) =>
                      old.some((x) => x.seconds === f.seconds)
                        ? old.filter((x) => x.seconds !== f.seconds)
                        : [...old, f],
                    );
                  }}
                />
              ))}
            </View>
            <Action
              secondary
              label={`Keep frame at ${(frame?.seconds || 0).toFixed(1)}s`}
              disabled={
                !frame || frames.some((f) => f.seconds === frame.seconds)
              }
              onPress={() => {
                if (frame) setFrames((old) => [...old, frame]);
              }}
            />
            <T style={v.small}>
              {frames.length} selected · {30 - pack.items.length} spaces in this
              pack
            </T>
            {!!frames.length && (
              <View style={v.wrap}>
                {frames.map((f) => (
                  <View key={f.seconds} style={{ alignItems: "center" }}>
                    <Art
                      design={{ ...defaultDesign(f.uri), decoration: "none" }}
                      size={85}
                    />
                    <Chip
                      label={`Remove ${f.seconds.toFixed(1)}s`}
                      onPress={() =>
                        setFrames((old) =>
                          old.filter((x) => x.seconds !== f.seconds),
                        )
                      }
                    />
                  </View>
                ))}
              </View>
            )}
            <Action
              label={`Add ${frames.length} frames to pack`}
              disabled={
                !frames.length || frames.length > 30 - pack.items.length
              }
              onPress={addFrames}
            />
            <Action
              secondary
              label="Cancel video selection"
              onPress={() => setVideo(null)}
            />
          </ScrollView>
        </View>
      </Modal>
    </Shell>
  );
}

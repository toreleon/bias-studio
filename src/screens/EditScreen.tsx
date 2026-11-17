import React, { useRef, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Action, Chip, Field, Journey, K, Shell, v } from "../CreatorUI";
import { Art, T } from "../ui";
import { useWorkspace } from "../WorkspaceProvider";
import { captions } from "../workspace";
import { StickerDesign } from "../domain";
import { cutoutAvailable, removeBackground } from "../media";
import { StyleControls } from "../StyleControls";
import Slider from "../Range";
export function EditScreen() {
  const { id, item: itemId } = useLocalSearchParams<{
    id: string;
    item: string;
  }>();
  const store = useWorkspace();
  const { width } = useWindowDimensions();
  const pack = store.data.collections.find((p) => p.id === id);
  const item = pack?.items.find((i) => i.id === itemId);
  const [tool, setTool] = useState("Caption");
  const [brush, setBrush] = useState<"erase" | "restore">("erase");
  const [radius, setRadius] = useState(18);
  const stroke = useRef<NonNullable<StickerDesign["strokes"]>[number] | null>(
    null,
  );
  const [pending, setPending] = useState<typeof stroke.current>(null);
  const [correcting, setCorrecting] = useState(false);
  const size = Math.min(width - 64, 390);
  if (!item || !pack)
    return (
      <Shell>
        <T>Reaction not found.</T>
        <Action
          label="Back to packs"
          onPress={() => router.replace("/packs")}
        />
      </Shell>
    );
  const design = item.design;
  const currentDesign = pending
    ? { ...design, strokes: [...(design.strokes || []), pending] }
    : design;
  function update(patch: Partial<StickerDesign>) {
    store.updatePack(id, (p) => ({
      ...p,
      items: p.items.map((i) =>
        i.id === itemId ? { ...i, design: { ...i.design, ...patch } } : i,
      ),
    }));
  }
  const point = (e: any) => ({
    x: Math.max(0, Math.min(512, (e.nativeEvent.locationX / size) * 512)),
    y: Math.max(0, Math.min(512, (e.nativeEvent.locationY / size) * 512)),
  });
  function endStroke() {
    if (stroke.current) {
      update({ strokes: [...(design.strokes || []), stroke.current] });
      stroke.current = null;
      setPending(null);
    }
  }
  return (
    <Shell tab={false} back={() => router.push(`/pack/${id}`)}>
      <Journey step={2} />
      <View style={[v.row, { justifyContent: "space-between" }]}>
        <View>
          <T style={v.eyebrow}>
            REACTION {pack.items.indexOf(item) + 1} OF {pack.items.length}
          </T>
          <T style={v.title}>Make it yours.</T>
        </View>
        <Action
          secondary
          label="Undo"
          disabled={!store.canUndo}
          onPress={store.undo}
        />
      </View>
      <View
        style={{
          backgroundColor: K.lavender,
          borderRadius: 26,
          padding: 10,
          alignItems: "center",
          gap: 8,
        }}
      >
        <View style={{ width: size, height: size }}>
          <Art design={currentDesign} size={size} />
          {correcting && (
            <View
              accessible
              accessibilityLabel="Cutout correction canvas"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: size,
                height: size,
              }}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={(e) => {
                if ((design.strokes?.length || 0) >= 1000) {
                  store.notice(
                    "This design has reached the brush limit. Undo or clear corrections before adding more.",
                  );
                  return;
                }
                stroke.current = { mode: brush, radius, points: [point(e)] };
                setPending({ ...stroke.current });
              }}
              onResponderMove={(e) => {
                if (stroke.current && stroke.current.points.length < 2000) {
                  stroke.current.points.push(point(e));
                  setPending({
                    ...stroke.current,
                    points: [...stroke.current.points],
                  });
                }
              }}
              onResponderRelease={endStroke}
              onResponderTerminate={endStroke}
            />
          )}
        </View>
        <T style={v.small}>
          {correcting
            ? `${brush === "erase" ? "Erase" : "Restore"} brush · drag on the image`
            : "Large preview · transparent outside the design"}
        </T>
      </View>
      {item.source?.seconds !== undefined && (
        <T style={v.small}>
          From {item.source.name} · {item.source.seconds.toFixed(1)}s
        </T>
      )}
      {item.legacy && (
        <T style={v.small}>
          Imported from the original MVP. The original sticker is flattened; new
          edits layer on top.
        </T>
      )}
      <View style={v.wrap}>
        {["Caption", "Style", "Crop", "Cutout"].map((t) => (
          <Chip
            key={t}
            label={t}
            selected={tool === t}
            onPress={() => {
              setTool(t);
              setCorrecting(false);
            }}
          />
        ))}
      </View>
      {tool === "Caption" && (
        <View style={v.card}>
          <Field
            label="Sticker caption"
            value={design.caption}
            onChange={(caption) => update({ caption })}
            maxLength={28}
            placeholder="Give the feeling a few words"
          />
          <T style={v.small}>
            Keep it short. You can check readability in chat preview.
          </T>
          <T style={v.eyebrow}>START WITH A FEELING</T>
          <View style={v.wrap}>
            {captions.map((c) => (
              <Chip key={c} label={c} onPress={() => update({ caption: c })} />
            ))}
          </View>
        </View>
      )}
      {tool === "Style" && (
        <View style={v.card}>
          <StyleControls design={design} onChange={update} />
        </View>
      )}
      {tool === "Crop" && (
        <View style={v.card}>
          {design.sample || design.flattened ? (
            <T style={v.sub}>
              This {design.sample ? "demo illustration" : "legacy sticker"}{" "}
              already has its framing. Photo and video imports support crop
              adjustment.
            </T>
          ) : (
            <>
              {(
                [
                  { key: "zoom", label: "Zoom", min: 1, max: 3, step: 0.05 },
                  {
                    key: "x",
                    label: "Move left / right",
                    min: -180,
                    max: 180,
                    step: 1,
                  },
                  {
                    key: "y",
                    label: "Move up / down",
                    min: -160,
                    max: 160,
                    step: 1,
                  },
                ] as const
              ).map((c) => (
                <View key={c.key}>
                  <T style={v.small}>{c.label}</T>
                  <Slider
                    accessibilityLabel={c.label}
                    minimumValue={c.min}
                    maximumValue={c.max}
                    step={c.step}
                    value={design[c.key]}
                    onValueChange={(n) => update({ [c.key]: n })}
                  />
                </View>
              ))}
              <Action
                secondary
                label="Reset crop"
                onPress={() => update({ zoom: 1, x: 0, y: 0 })}
              />
              <T style={v.small}>
                Brush corrections stay at their canvas positions. Adjust crop
                before refining edges.
              </T>
            </>
          )}
        </View>
      )}
      {tool === "Cutout" && (
        <View style={v.card}>
          <T style={v.section}>Keep the feeling. Lose the background.</T>
          {!design.sample && !design.flattened && (
            <>
              {cutoutAvailable ? (
                <Action
                  label="Remove background"
                  onPress={() =>
                    store.run("Cutting out your subject…", async () => {
                      const original = design.originalSource || design.source;
                      const source = await removeBackground(original);
                      update({
                        source,
                        originalSource: original,
                        shape: "cutout",
                        strokes: [],
                      });
                    })
                  }
                />
              ) : (
                <T style={v.sub}>
                  Automatic person cutout is available in the native app. Manual
                  erase works here too.
                </T>
              )}
              <Action
                secondary
                label="Restore original image"
                onPress={() => {
                  update({
                    source: design.originalSource || design.source,
                    shape: "rounded",
                    strokes: [],
                  });
                  setCorrecting(false);
                }}
              />
            </>
          )}
          <Action
            secondary
            label={correcting ? "Finish corrections" : "Correct edges manually"}
            onPress={() => {
              if (!correcting)
                update({
                  shape: "cutout",
                  originalSource: design.originalSource || design.source,
                });
              setCorrecting(!correcting);
            }}
          />
          {correcting && (
            <>
              <View style={v.wrap}>
                <Chip
                  label="Erase brush"
                  selected={brush === "erase"}
                  onPress={() => setBrush("erase")}
                />
                <Chip
                  label="Restore brush"
                  selected={brush === "restore"}
                  onPress={() => setBrush("restore")}
                />
              </View>
              <T style={v.small}>Brush size</T>
              <Slider
                accessibilityLabel="Brush size"
                minimumValue={4}
                maximumValue={60}
                step={2}
                value={radius}
                onValueChange={setRadius}
              />
              <Action
                secondary
                label="Undo last brush stroke"
                disabled={!design.strokes?.length}
                onPress={() =>
                  update({ strokes: design.strokes?.slice(0, -1) })
                }
              />
              <Action
                secondary
                label="Clear corrections"
                disabled={!design.strokes?.length}
                onPress={() => update({ strokes: [] })}
              />
            </>
          )}
          <T style={v.small}>
            Erase removes image pixels. Restore paints the original photo back.
            Use Undo if an edge needs another pass.
          </T>
        </View>
      )}
      <Action
        label="Done refining"
        onPress={() => router.push(`/pack/${id}`)}
      />
    </Shell>
  );
}

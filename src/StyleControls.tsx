import React from "react";
import { View } from "react-native";
import { PALETTE, StickerDesign, newId } from "./domain";
import { Action, Chip, Field, K, v } from "./CreatorUI";
import { T } from "./ui";
import { PackStyle, styleOf } from "./workspace";
import { useWorkspace } from "./WorkspaceProvider";
export function StyleControls({
  design,
  onChange,
}: {
  design: StickerDesign;
  onChange: (patch: Partial<StickerDesign>) => void;
}) {
  const store = useWorkspace();
  const [advanced, setAdvanced] = React.useState(false);
  const [name, setName] = React.useState("");
  return (
    <View style={{ gap: 16 }}>
      {store.data.styles.length > 0 && (
        <>
          <T style={v.eyebrow}>YOUR SAVED STYLES</T>
          <View style={v.wrap}>
            {store.data.styles.map((style) => (
              <Chip
                key={style.id}
                label={`Use ${style.name}`}
                onPress={() => onChange(style.style)}
              />
            ))}
          </View>
        </>
      )}
      <T style={v.small}>Color palette</T>
      <View style={v.wrap}>
        {PALETTE.map((color) => (
          <Chip
            key={color}
            label={
              (
                {
                  "#A28AF0": "Lilac",
                  "#FF8EB4": "Rose",
                  "#8BCCB5": "Mint",
                  "#FFC467": "Peach",
                  "#91B6F2": "Sky",
                  "#FAFAFA": "Cloud",
                } as any
              )[color]
            }
            selected={design.color === color}
            onPress={() => onChange({ color })}
          />
        ))}
      </View>
      <T style={v.small}>Caption font</T>
      <View style={v.wrap}>
        {(["rounded", "serif", "mono"] as const).map((font) => (
          <Chip
            key={font}
            label={
              font === "rounded"
                ? "Bold"
                : font === "serif"
                  ? "Editorial"
                  : "Typewriter"
            }
            selected={(design.font || "rounded") === font}
            onPress={() => onChange({ font })}
          />
        ))}
      </View>
      <T style={v.small}>Caption placement</T>
      <View style={v.wrap}>
        {(["top", "middle", "bottom"] as const).map((captionPosition) => (
          <Chip
            key={captionPosition}
            label={`${captionPosition[0].toUpperCase() + captionPosition.slice(1)} caption`}
            selected={(design.captionPosition || "bottom") === captionPosition}
            onPress={() => onChange({ captionPosition })}
          />
        ))}
      </View>
      <Action
        secondary
        label={advanced ? "Hide advanced style" : "More style options"}
        onPress={() => setAdvanced(!advanced)}
      />
      {advanced && (
        <View style={{ gap: 14 }}>
          <T style={v.small}>Frame</T>
          <View style={v.wrap}>
            {(["rounded", "circle", "cutout"] as const).map((shape) => (
              <Chip
                key={shape}
                label={
                  shape === "cutout"
                    ? "Unframed"
                    : shape === "circle"
                      ? "Circle"
                      : "Soft square"
                }
                selected={design.shape === shape}
                onPress={() => onChange({ shape })}
              />
            ))}
          </View>
          <T style={v.small}>Decoration</T>
          <View style={v.wrap}>
            {(["sparkles", "hearts", "none"] as const).map((decoration) => (
              <Chip
                key={decoration}
                label={decoration}
                selected={design.decoration === decoration}
                onPress={() => onChange({ decoration })}
              />
            ))}
          </View>
          <T style={v.small}>Caption outline</T>
          <View style={v.wrap}>
            {[0, 8, 16, 24].map((outline) => (
              <Chip
                key={outline}
                label={`${outline}px outline`}
                selected={(design.outline ?? 12) === outline}
                onPress={() => onChange({ outline })}
              />
            ))}
          </View>
          <T style={v.small}>Caption ink</T>
          <View style={v.wrap}>
            {[
              ["Plum ink", "#30233E"],
              ["White ink", "#FFFFFF"],
              ["Pink ink", "#B52B64"],
            ].map(([label, captionColor]) => (
              <Chip
                key={label}
                label={label}
                selected={(design.captionColor || "#30233E") === captionColor}
                onPress={() => onChange({ captionColor })}
              />
            ))}
          </View>
          <T style={v.small}>Outline color</T>
          <View style={v.wrap}>
            {[
              ["White outline", "#FFFFFF"],
              ["Plum outline", "#30233E"],
            ].map(([label, outlineColor]) => (
              <Chip
                key={label}
                label={label}
                selected={(design.outlineColor || "#FFFFFF") === outlineColor}
                onPress={() => onChange({ outlineColor })}
              />
            ))}
          </View>
        </View>
      )}
      <View
        style={{
          padding: 16,
          borderRadius: 16,
          backgroundColor: K.lavender,
          gap: 10,
        }}
      >
        <T style={{ fontFamily: "DMSans_700Bold" }}>Make this your signature</T>
        <Field
          label="Style name"
          value={name}
          onChange={setName}
          placeholder="e.g. Encore lilac"
        />
        <Action
          secondary
          label="Save reusable style"
          disabled={!name.trim()}
          onPress={() => {
            const style: PackStyle = styleOf(design);
            store.change((old) => ({
              ...old,
              styles: [
                ...old.styles,
                { id: newId(), name: name.trim(), style },
              ],
            }));
            setName("");
            store.notice(
              "Style saved. Use it on selected reactions in any pack.",
            );
          }}
        />
      </View>
    </View>
  );
}

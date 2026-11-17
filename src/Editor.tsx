import React from "react";
import { Pressable, TextInput, View } from "react-native";
import { SvgXml } from "react-native-svg";
import Slider from "./Range";
import {
  ArrowLeft,
  Check,
  Clapperboard,
  ImagePlus,
  LockKeyhole,
  MessageCircle,
  Plus,
  Scissors,
  Sparkles,
  WandSparkles,
} from "lucide-react-native";
import { PALETTE, StickerDesign } from "./domain";
import { scene } from "./scene";
import { cutoutAvailable, Media } from "./media";
import { Button, C, IconButton, s, T } from "./ui";

export default function Editor({
  design,
  update,
  wide,
  width,
  captureView,
  video,
  frameTime,
  onFrame,
  originalSource,
  onCutout,
  onImport,
  onBack,
  onSave,
}: {
  design: StickerDesign;
  update: (patch: Partial<StickerDesign>) => void;
  wide: boolean;
  width: number;
  captureView: React.RefObject<View | null>;
  video: Media | null;
  frameTime: number;
  onFrame: (time: number) => void;
  originalSource: string;
  onCutout: () => void;
  onImport: () => void;
  onBack: () => void;
  onSave: () => void;
}) {
  const [tool, setTool] = React.useState<"style" | "caption" | "crop">("style");
  const size = wide ? 350 : Math.min(width - 80, 350);
  return (
    <>
      <View style={[s.heading, { flexWrap: "wrap" }]}>
        <View style={[s.row, { flex: 1, minWidth: 155 }]}>
          <IconButton label="Leave editor" icon={ArrowLeft} onPress={onBack} />
          <View style={{ flex: 1 }}>
            <T style={{ fontSize: 21, fontFamily: "DMSans_700Bold" }}>
              Make it yours
            </T>
            <T style={s.meta}>
              {video
                ? "A split second, a whole feeling."
                : "A little edit. A lot of personality."}
            </T>
          </View>
        </View>
        <Button small label="Save sticker" icon={Check} onPress={onSave} />
      </View>
      <View style={[s.editorLayout, !wide && { flexDirection: "column" }]}>
        <View
          style={[
            s.canvasPanel,
            !wide && { width: "100%", flex: undefined, padding: 12 },
          ]}
        >
          <View style={s.canvasHeading}>
            <View style={s.row}>
              <View style={s.dot} />
              <T style={s.eyebrow}>YOUR LITTLE MASTERPIECE</T>
            </View>
            <T style={{ fontSize: 10, color: C.muted }}>512 × 512</T>
          </View>
          <View style={[s.stage, { minHeight: size + 30 }]}>
            <View style={s.dots} pointerEvents="none">
              {Array.from({ length: 144 }, (_, i) => (
                <View
                  key={i}
                  style={{
                    width: 3,
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: "#DDD4E5",
                    margin: 11,
                  }}
                />
              ))}
            </View>
            <View
              ref={captureView}
              collapsable={false}
              style={{
                width: size,
                height: size,
                backgroundColor: "transparent",
              }}
            >
              <SvgXml xml={scene(design)} width="100%" height="100%" />
            </View>
          </View>
          <View style={s.canvasFooter}>
            <LockKeyhole size={12} color={C.muted} />
            <T style={{ fontSize: 11, color: C.muted }}>
              Transparent background · Stays on your device
            </T>
          </View>
        </View>
        <View style={[s.controls, !wide && { width: "100%" }]}>
          {video && (
            <View style={s.videoControl}>
              <View style={s.row}>
                <Clapperboard size={15} color={C.purple} />
                <T style={{ fontSize: 13, fontFamily: "DMSans_600SemiBold" }}>
                  Find your moment
                </T>
                <T style={[s.meta, { marginLeft: "auto" }]}>
                  {frameTime.toFixed(1)}s / {video.duration.toFixed(1)}s
                </T>
              </View>
              <Slider
                accessibilityLabel="Video frame time"
                minimumValue={0}
                maximumValue={Math.max(0.1, video.duration - 0.05)}
                step={0.1}
                value={frameTime}
                minimumTrackTintColor={C.purple}
                thumbTintColor={C.purple}
                onSlidingComplete={onFrame}
              />
              <T style={{ fontSize: 10, color: C.muted }}>
                Choose a frame to make a still sticker.
              </T>
            </View>
          )}
          <View style={s.tabs}>
            {(
              [
                { key: "style", icon: WandSparkles, label: "Style" },
                { key: "caption", icon: MessageCircle, label: "Caption" },
                { key: "crop", icon: Scissors, label: "Crop" },
              ] as const
            ).map((item) => (
              <Pressable
                key={item.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: tool === item.key }}
                onPress={() => setTool(item.key)}
                style={[s.toolTab, tool === item.key && s.toolSelected]}
              >
                <item.icon
                  size={15}
                  color={tool === item.key ? C.purple : C.muted}
                />
                <T
                  style={{
                    fontSize: 12,
                    color: tool === item.key ? C.purple : C.muted,
                    fontFamily: "DMSans_600SemiBold",
                  }}
                >
                  {item.label}
                </T>
              </Pressable>
            ))}
          </View>
          {tool === "style" && (
            <View style={s.controlBody}>
              <T style={s.label}>THE PERFECT FRAME</T>
              <View style={s.row}>
                {(["rounded", "circle", "cutout"] as const).map((shape) => (
                  <Pressable
                    key={shape}
                    accessibilityRole="button"
                    accessibilityLabel={`${shape} frame`}
                    accessibilityState={{ selected: design.shape === shape }}
                    onPress={() => update({ shape })}
                    style={[
                      s.shapeButton,
                      shape === design.shape && s.shapeSelected,
                    ]}
                  >
                    <View
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius:
                          shape === "circle" ? 15 : shape === "rounded" ? 7 : 2,
                        borderWidth: shape === "cutout" ? 1 : 2,
                        borderStyle: shape === "cutout" ? "dashed" : "solid",
                        borderColor:
                          shape === design.shape ? C.purple : "#B4A7C0",
                      }}
                    />
                    <T style={{ fontSize: 10, marginTop: 7, color: C.muted }}>
                      {shape === "cutout"
                        ? "Unframed"
                        : shape === "circle"
                          ? "Circle"
                          : "Soft square"}
                    </T>
                  </Pressable>
                ))}
              </View>
              {!design.sample && (
                <View style={{ marginTop: 22 }}>
                  <Button
                    secondary
                    label={
                      design.source !== originalSource
                        ? "Restore original photo"
                        : "Remove background"
                    }
                    icon={Scissors}
                    onPress={onCutout}
                  />
                  <T
                    style={{
                      color: C.muted,
                      fontSize: 10,
                      marginTop: 8,
                      lineHeight: 16,
                    }}
                  >
                    {cutoutAvailable
                      ? "Person cutout runs on your device. Best with one clear subject."
                      : "Person cutout is available in the native mobile app."}
                  </T>
                </View>
              )}
              <T style={[s.label, { marginTop: 25 }]}>A POP OF COLOR</T>
              <View style={[s.row, { gap: 12, flexWrap: "wrap" }]}>
                {PALETTE.map((color) => (
                  <Pressable
                    key={color}
                    accessibilityRole="button"
                    accessibilityLabel={`Color ${color}`}
                    accessibilityState={{ selected: color === design.color }}
                    onPress={() => update({ color })}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 18,
                      backgroundColor: color,
                      borderWidth: color === design.color ? 2 : 1,
                      borderColor: color === design.color ? C.ink : "#E6DDED",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {color === design.color && (
                      <Check
                        size={15}
                        color={color === "#FAFAFA" ? C.ink : "white"}
                      />
                    )}
                  </Pressable>
                ))}
              </View>
              <T style={[s.label, { marginTop: 25 }]}>A LITTLE EXTRA</T>
              <View style={s.row}>
                {(["sparkles", "hearts", "none"] as const).map((decoration) => (
                  <Pressable
                    key={decoration}
                    accessibilityRole="button"
                    accessibilityLabel={decoration}
                    accessibilityState={{
                      selected: decoration === design.decoration,
                    }}
                    onPress={() => update({ decoration })}
                    style={[
                      s.chip,
                      decoration === design.decoration && s.chipSelected,
                    ]}
                  >
                    <T style={{ fontSize: 12, color: C.muted }}>
                      {decoration === "sparkles"
                        ? "✧ Sparkles"
                        : decoration === "hearts"
                          ? "♡ Hearts"
                          : "Just me"}
                    </T>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          {tool === "caption" && (
            <View style={s.controlBody}>
              <T style={s.label}>SAY IT YOUR WAY</T>
              <TextInput
                accessibilityLabel="Sticker caption"
                value={design.caption}
                onChangeText={(caption) => update({ caption })}
                maxLength={28}
                placeholder="e.g. my whole heart"
                placeholderTextColor="#B1A5BC"
                style={s.input}
              />
              <T style={[s.meta, { textAlign: "right", marginTop: 6 }]}>
                {design.caption.length} / 28
              </T>
              <T style={[s.label, { marginTop: 24 }]}>WORDS FOR THE FEELING</T>
              <View style={{ gap: 9 }}>
                {[
                  "my whole heart",
                  "LET’S GOOO",
                  "I am not okay",
                  "you did that!",
                  "just one more fancam",
                ].map((caption) => (
                  <Pressable
                    key={caption}
                    accessibilityRole="button"
                    onPress={() => update({ caption })}
                    style={s.captionOption}
                  >
                    <T style={{ fontSize: 13, color: C.muted }}>{caption}</T>
                    <Plus size={14} color="#B2A4BF" />
                  </Pressable>
                ))}
              </View>
              <T style={[s.meta, { marginTop: 20, lineHeight: 19 }]}>
                Short captions look best in chat. Keep the feeling big and the
                words little.
              </T>
            </View>
          )}
          {tool === "crop" && (
            <View style={s.controlBody}>
              {design.sample ? (
                <>
                  <Sparkles size={25} color={C.purple} />
                  <T style={[s.sub, { marginVertical: 18 }]}>
                    This demo character is already framed. Import your own photo
                    to zoom and position it.
                  </T>
                  <Button
                    secondary
                    label="Choose a photo"
                    icon={ImagePlus}
                    onPress={onImport}
                  />
                </>
              ) : (
                <>
                  {(
                    [
                      {
                        label: "Zoom",
                        key: "zoom",
                        min: 1,
                        max: 3,
                        step: 0.05,
                      },
                      {
                        label: "Move left / right",
                        key: "x",
                        min: -180,
                        max: 180,
                        step: 1,
                      },
                      {
                        label: "Move up / down",
                        key: "y",
                        min: -160,
                        max: 160,
                        step: 1,
                      },
                    ] as const
                  ).map((control) => (
                    <View key={control.key} style={{ marginBottom: 25 }}>
                      <T style={s.label}>{control.label.toUpperCase()}</T>
                      <Slider
                        accessibilityLabel={control.label}
                        minimumValue={control.min}
                        maximumValue={control.max}
                        step={control.step}
                        value={design[control.key]}
                        onValueChange={(value) =>
                          update({ [control.key]: value })
                        }
                        minimumTrackTintColor={C.purple}
                        thumbTintColor={C.purple}
                      />
                    </View>
                  ))}
                  <Button
                    secondary
                    label="Reset crop"
                    onPress={() => update({ zoom: 1, x: 0, y: 0 })}
                  />
                </>
              )}
            </View>
          )}
        </View>
      </View>
      <View style={[s.row, { justifyContent: "center", marginTop: 23 }]}>
        <Sparkles size={14} color="#B69BCF" />
        <T style={{ fontSize: 12, color: C.muted, flexShrink: 1 }}>
          Made for your group chat. Saved in a pack. Ready for every feeling.
        </T>
      </View>
    </>
  );
}

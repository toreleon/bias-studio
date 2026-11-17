import React from "react";
import { Pressable, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowRight,
  Clapperboard,
  FolderHeart,
  Heart,
  ImagePlus,
  LockKeyhole,
  Plus,
  Sparkles,
  Star,
} from "lucide-react-native";
import { defaultDesign, Mood, Pack, PALETTE } from "./domain";
import { Art, Button, C, s, T } from "./ui";
export default function Home({
  wide,
  packs,
  total,
  onPhoto,
  onVideo,
  onNewPack,
  onPacks,
  onSample,
  renderPack,
}: {
  wide: boolean;
  packs: Pack[];
  total: number;
  onPhoto: () => void;
  onVideo: () => void;
  onNewPack: () => void;
  onPacks: () => void;
  onSample: (mood: Mood) => void;
  renderPack: (pack: Pack) => React.ReactNode;
}) {
  return (
    <>
      <View style={s.heading}>
        <View style={{ flex: 1 }}>
          <View style={s.row}>
            <View style={s.dot} />
            <T style={s.eyebrow}>MADE BY FANS, FOR THE FEELINGS</T>
          </View>
          <T style={[s.title, !wide && { fontSize: 28 }]}>
            A little bias. A lot of expression.
          </T>
          <T style={s.sub}>
            Turn the moments you love into the stickers you send.
          </T>
        </View>
        {wide && (
          <View style={s.pill}>
            <Heart size={15} color={C.purple} />
            <T style={{ fontSize: 12, color: C.purple }}>
              {total} little favorites
            </T>
          </View>
        )}
      </View>
      <LinearGradient
        colors={["#F0E7FB", "#EAE4F9", "#F9E9F1"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.hero, !wide && { padding: 26, minHeight: 350 }]}
      >
        <View style={[s.heroCopy, !wide && { width: "100%" }]}>
          <View style={s.badge}>
            <Sparkles size={12} color={C.purple} />
            <T
              style={{
                color: C.purple,
                fontSize: 9,
                letterSpacing: 1.3,
                fontFamily: "DMSans_700Bold",
              }}
            >
              YOUR FANDOM, REMIXED
            </T>
          </View>
          <T style={[s.heroTitle, !wide && { fontSize: 34, lineHeight: 40 }]}>
            Your favorite moments,{wide ? "\n" : " "}now in the chat.
          </T>
          <T style={[s.heroSub, !wide && { maxWidth: 255 }]}>
            The iconic reactions. The tiny heart hands.{wide ? "\n" : " "}Make
            them a sticker. Make someone’s day.
          </T>
          <View style={{ marginTop: 22, alignSelf: "flex-start" }}>
            <Button label="Make a sticker" icon={Plus} onPress={onPhoto} />
          </View>
          <View style={[s.row, { marginTop: 12, gap: 5 }]}>
            <LockKeyhole size={11} color="#8A7B9A" />
            <T style={{ color: "#8A7B9A", fontSize: 10 }}>
              Your photos stay on your device.
            </T>
          </View>
        </View>
        <View
          pointerEvents="none"
          style={[
            s.heroArt,
            !wide && {
              position: "relative",
              right: 0,
              top: 0,
              alignSelf: "flex-end",
              marginTop: 8,
              marginBottom: -12,
              width: 180,
              height: 140,
            },
          ]}
        >
          <Heart
            size={22}
            color="#E4ABC5"
            fill="#E4ABC5"
            style={{
              position: "absolute",
              top: 26,
              left: 23,
              transform: [{ rotate: "-15deg" }],
            }}
          />
          <Star
            size={23}
            color="#AE92D5"
            fill="#C9B7E8"
            style={{ position: "absolute", top: 20, right: 28 }}
          />
          <Art
            design={{
              ...defaultDesign("", "love"),
              caption: "my whole heart",
              color: "#E798B9",
              decoration: "hearts",
            }}
            size={wide ? 236 : 148}
            style={{
              position: "absolute",
              top: wide ? 8 : 1,
              left: wide ? 53 : 15,
              transform: [{ rotate: "-11deg" }],
            }}
          />
          {wide && (
            <>
              <Art
                design={{
                  ...defaultDesign("", "hype"),
                  caption: "LET’S GOOO",
                  color: "#A18AD0",
                }}
                size={197}
                style={{
                  position: "absolute",
                  right: -12,
                  top: 105,
                  transform: [{ rotate: "13deg" }],
                }}
              />
              <T
                style={{
                  position: "absolute",
                  right: 15,
                  bottom: 9,
                  color: "#947DA8",
                  fontSize: 10,
                  transform: [{ rotate: "-5deg" }],
                }}
              >
                too cute to stay in your camera roll ↗
              </T>
            </>
          )}
        </View>
      </LinearGradient>
      <View style={s.sectionHeading}>
        <View style={s.row}>
          <View style={s.sectionNumber}>
            <T style={s.eyebrow}>01</T>
          </View>
          <T style={s.sectionTitle}>Start with a moment</T>
        </View>
        {wide && (
          <T style={{ fontSize: 10, color: "#A69AAE" }}>
            A photo. A video. A whole mood.
          </T>
        )}
      </View>
      <View style={[s.importRow, !wide && { flexDirection: "column" }]}>
        {[
          {
            title: "From a photo",
            description: "One perfect expression. Endless possibilities.",
            label: "Create from photo",
            icon: ImagePlus,
            action: onPhoto,
            color: C.purple,
            bg: "#F1EAFB",
          },
          {
            title: "From a video",
            description: "Find that split second you can’t get over.",
            label: "Create from video",
            icon: Clapperboard,
            action: onVideo,
            color: "#CB7B9A",
            bg: "#FBEFF4",
          },
        ].map((item) => (
          <Pressable
            key={item.title}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={item.action}
            style={({ pressed }) => [
              s.importCard,
              pressed && { borderColor: "#CBB4E5" },
            ]}
          >
            <View style={[s.importIcon, { backgroundColor: item.bg }]}>
              <item.icon size={24} color={item.color} strokeWidth={1.5} />
            </View>
            <View style={{ flex: 1 }}>
              <T style={s.importTitle}>{item.title}</T>
              <T style={s.importSub}>{item.description}</T>
            </View>
            <ArrowRight size={18} color={C.muted} />
          </Pressable>
        ))}
      </View>
      <View style={s.sectionHeading}>
        <View style={s.row}>
          <View style={s.sectionNumber}>
            <T style={s.eyebrow}>02</T>
          </View>
          <T style={s.sectionTitle}>Your sticker shelf</T>
          <View style={s.tinyCount}>
            <T style={{ fontSize: 10, color: C.muted }}>{packs.length}</T>
          </View>
        </View>
        <Pressable accessibilityRole="button" onPress={onPacks}>
          <T style={s.link}>View all →</T>
        </Pressable>
      </View>
      {packs.length ? (
        <View style={[s.packGrid, !wide && { flexDirection: "column" }]}>
          {packs.slice(0, 3).map(renderPack)}
        </View>
      ) : (
        <View style={s.emptyShelf}>
          <View style={s.shelfIcon}>
            <FolderHeart size={28} color="#B6A0D3" strokeWidth={1.4} />
          </View>
          <View style={{ flex: 1, minWidth: 150 }}>
            <T style={{ fontSize: 16, fontFamily: "DMSans_600SemiBold" }}>
              Every obsession deserves a pack.
            </T>
            <T style={[s.meta, { marginTop: 5 }]}>
              Give your favorite reactions a home. Start your first collection.
            </T>
          </View>
          <Button
            small
            secondary
            label="New pack"
            icon={Plus}
            onPress={onNewPack}
          />
        </View>
      )}
      <View style={s.inspiration}>
        <View style={[s.inspirationCopy, !wide && { width: "100%" }]}>
          <View style={s.row}>
            <Sparkles size={14} color={C.purple} />
            <T style={s.eyebrow}>A LITTLE INSPIRATION</T>
          </View>
          <T
            style={{
              fontSize: 22,
              fontFamily: "DMSans_700Bold",
              marginTop: 13,
            }}
          >
            There’s a sticker for that feeling.
          </T>
          <T style={[s.sub, { marginTop: 7 }]}>
            Try an original character. Add your own kind of extra.
          </T>
          <T style={[s.meta, { fontSize: 10, marginTop: 15 }]}>
            Original demo artwork · Tap any sticker to remix
          </T>
        </View>
        <View
          style={[
            s.sampleRow,
            !wide && { width: "100%", justifyContent: "center" },
          ]}
        >
          {(["love", "hype", "happy"] as Mood[]).map((mood, index) => (
            <Pressable
              key={mood}
              accessibilityRole="button"
              accessibilityLabel={`Remix ${mood} sticker`}
              onPress={() => onSample(mood)}
              style={({ pressed }) => ({
                transform: [
                  { rotate: `${(index - 1) * 8}deg` },
                  { scale: pressed ? 1.07 : 1 },
                ],
              })}
            >
              <Art
                design={{
                  ...defaultDesign("", mood),
                  caption:
                    mood === "love"
                      ? "love you!"
                      : mood === "hype"
                        ? "LET’S GO"
                        : "so proud",
                  color: PALETTE[index],
                }}
                size={wide ? 126 : 98}
              />
            </Pressable>
          ))}
        </View>
      </View>
      <View style={s.footer}>
        <T style={s.footerText}>A tiny studio for your biggest feelings.</T>
        <View style={s.row}>
          <Heart size={11} color="#C9B7DA" />
          <T style={s.footerText}>Made with a little extra love</T>
        </View>
      </View>
    </>
  );
}

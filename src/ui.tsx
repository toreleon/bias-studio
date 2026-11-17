import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { Sticker, StickerDesign } from "./domain";
import { scene } from "./scene";
export const C = {
  ink: "#302837",
  muted: "#8D8197",
  purple: "#8861CC",
  line: "#EBE4F0",
  bg: "#FBFAFC",
};
export function T({ style, ...props }: any) {
  return (
    <Text
      {...props}
      style={[{ fontFamily: "DMSans_400Regular", color: C.ink }, style]}
    />
  );
}
export function Button({
  label,
  onPress,
  icon: Icon,
  secondary = false,
  disabled = false,
  small = false,
}: any) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        small && { paddingHorizontal: 16, paddingVertical: 11 },
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.75 },
      ]}
    >
      {Icon && (
        <Icon
          size={16}
          color={secondary ? C.purple : "white"}
          strokeWidth={1.8}
        />
      )}
      <T style={[s.buttonText, secondary && { color: C.purple }]}>{label}</T>
    </Pressable>
  );
}
export function IconButton({ icon: Icon, label, onPress }: any) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ padding: 10 }}
    >
      <Icon size={20} color={C.muted} strokeWidth={1.7} />
    </Pressable>
  );
}
export function Art({
  design,
  size = 150,
  style,
}: {
  design: StickerDesign;
  size?: number;
  style?: any;
}) {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <SvgXml xml={scene(design)} width="100%" height="100%" />
    </View>
  );
}
export function StickerImage({
  sticker,
  size = 100,
}: {
  sticker: Sticker;
  size?: number;
}) {
  return (
    <Image
      accessibilityLabel={sticker.caption || "Created sticker"}
      source={{ uri: sticker.uri }}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}
export const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  text: { fontFamily: "DMSans_400Regular", color: C.ink },
  bold: { fontFamily: "DMSans_700Bold" },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.bg,
  },
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  headerInner: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    height: 84,
    paddingHorizontal: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#A185D4",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-8deg" }],
  },
  logoText: {
    fontFamily: "DMSans_800ExtraBold",
    fontSize: 25,
    letterSpacing: -1.4,
  },
  avatar: {
    width: 33,
    height: 33,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3ECFA",
    borderWidth: 1,
    borderColor: "#EBE0F5",
  },
  nav: { flexDirection: "row", gap: 6 },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 17,
    paddingVertical: 11,
    borderRadius: 9,
  },
  navSelected: { backgroundColor: "#F2ECFA" },
  navText: { fontSize: 12, fontFamily: "DMSans_500Medium", color: C.muted },
  content: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    paddingHorizontal: 36,
    paddingTop: 38,
    paddingBottom: 25,
  },
  heading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 15,
    marginBottom: 26,
  },
  eyebrow: {
    fontFamily: "DMSans_600SemiBold",
    color: "#A393B0",
    fontSize: 9,
    letterSpacing: 1.3,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#B29BD0" },
  title: {
    fontFamily: "DMSans_700Bold",
    fontSize: 29,
    letterSpacing: -1,
    marginTop: 10,
    marginBottom: 8,
  },
  sub: { color: C.muted, fontSize: 13, lineHeight: 21 },
  meta: { fontSize: 11, lineHeight: 17, color: "#A195AA" },
  pill: {
    backgroundColor: "#F2EBF9",
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  hero: { borderRadius: 20, padding: 36, minHeight: 320, overflow: "hidden" },
  heroCopy: { width: "61%", zIndex: 1 },
  badge: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#FAF5FE88",
    borderWidth: 1,
    borderColor: "#DBCCED",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 38,
    lineHeight: 44,
    color: "#4E3B62",
    letterSpacing: -1.4,
    marginTop: 14,
  },
  heroSub: { color: "#8C789D", fontSize: 12, lineHeight: 21, marginTop: 13 },
  heroArt: { position: "absolute", width: 395, height: 320, right: 34, top: 0 },
  sectionHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginTop: 29,
    marginBottom: 16,
  },
  sectionNumber: {
    width: 25,
    height: 25,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#F0EBF5",
  },
  sectionTitle: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 17,
    letterSpacing: -0.4,
  },
  tinyCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: "#F0EAF5",
  },
  link: { color: C.purple, fontSize: 11, fontFamily: "DMSans_500Medium" },
  importRow: { flexDirection: "row", gap: 16 },
  importCard: {
    flex: 1,
    backgroundColor: "white",
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  importIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1EAFB",
  },
  importTitle: { fontSize: 14, fontFamily: "DMSans_600SemiBold" },
  importSub: { fontSize: 11, lineHeight: 17, color: "#A195AA", marginTop: 5 },
  button: {
    backgroundColor: C.purple,
    borderRadius: 9,
    paddingHorizontal: 21,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 44,
  },
  secondary: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E4D9EE",
  },
  buttonText: {
    color: "white",
    fontFamily: "DMSans_600SemiBold",
    fontSize: 12,
  },
  shelfIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#F1EAF9",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyShelf: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#DED2E9",
    borderRadius: 13,
    padding: 23,
    backgroundColor: "#FFFDFE",
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    flexWrap: "wrap",
  },
  packGrid: { flexDirection: "row", gap: 19, flexWrap: "wrap" },
  packCard: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 13,
    overflow: "hidden",
  },
  packPreview: {
    height: 160,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  packTag: {
    position: "absolute",
    left: 11,
    bottom: 9,
    borderRadius: 5,
    backgroundColor: "#FFFFFFBB",
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  packInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 17,
  },
  inspiration: {
    marginTop: 28,
    borderRadius: 14,
    padding: 25,
    backgroundColor: "#F4F0F7",
    borderWidth: 1,
    borderColor: "#EDE4F3",
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    overflow: "hidden",
  },
  inspirationCopy: { width: "53%" },
  sampleRow: { flexDirection: "row", width: "47%", justifyContent: "flex-end" },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 30,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 18,
  },
  footerText: { color: "#B0A6B9", fontSize: 10 },
  bottomNav: {
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  bottomNavInner: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
  },
  bottomNavItem: { width: 85, alignItems: "center", padding: 4 },
  largeEmpty: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#E3D8ED",
    borderRadius: 20,
    padding: 42,
    alignItems: "center",
  },
  whatsappBanner: {
    backgroundColor: "#EEF5EF",
    borderWidth: 1,
    borderColor: "#DEEBDD",
    borderRadius: 13,
    padding: 20,
    flexDirection: "row",
    gap: 20,
    alignItems: "center",
    marginBottom: 22,
  },
  whatsappIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: "#DFEDE2",
    alignItems: "center",
    justifyContent: "center",
  },
  note: {
    padding: 15,
    borderRadius: 9,
    backgroundColor: "#F2EDF7",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 20,
  },
  stickerGrid: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  stickerTile: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addTile: {
    backgroundColor: "#F9F5FC",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#DCD0E9",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  editorLayout: { flexDirection: "row", gap: 24, alignItems: "flex-start" },
  canvasPanel: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    padding: 20,
  },
  canvasHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    paddingBottom: 15,
  },
  stage: {
    backgroundColor: "#F9F7FB",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 12,
    marginVertical: 17,
  },
  dots: {
    position: "absolute",
    width: 340,
    height: 340,
    flexDirection: "row",
    flexWrap: "wrap",
    opacity: 0.7,
  },
  canvasFooter: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 2,
  },
  controls: {
    width: 345,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    overflow: "hidden",
  },
  tabs: {
    flexDirection: "row",
    gap: 4,
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  toolTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 12,
    borderRadius: 7,
  },
  toolSelected: { backgroundColor: "#F2ECFB" },
  controlBody: { padding: 23 },
  label: {
    fontSize: 9,
    color: "#9D8CAA",
    fontFamily: "DMSans_600SemiBold",
    letterSpacing: 1.3,
    marginBottom: 14,
  },
  shapeButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    paddingVertical: 14,
  },
  shapeSelected: { borderColor: "#BEA0DE", backgroundColor: "#FAF6FE" },
  chip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 7,
  },
  chipSelected: { borderColor: "#C9AFE6", backgroundColor: "#F7F0FD" },
  input: {
    padding: 14,
    borderWidth: 1,
    borderColor: "#E0D5EA",
    borderRadius: 9,
    backgroundColor: "#FEFCFF",
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: C.ink,
  },
  captionOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
  },
  videoControl: {
    padding: 17,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    backgroundColor: "#FAF7FE",
    gap: 10,
  },
  aboutRow: {
    flexDirection: "row",
    gap: 17,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  shade: {
    flex: 1,
    backgroundColor: "#30223866",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modal: {
    width: "100%",
    maxWidth: 430,
    maxHeight: "90%",
    borderRadius: 20,
    backgroundColor: "white",
    padding: 28,
  },
  modalTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: "DMSans_700Bold",
    letterSpacing: -0.6,
  },
  packChoice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 9,
    marginBottom: 8,
  },
  toast: {
    position: "absolute",
    bottom: 85,
    alignSelf: "center",
    maxWidth: 430,
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#48374F",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    zIndex: 20,
  },
  busy: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FBFAFCCC",
    zIndex: 50,
  },
  busyCard: {
    borderWidth: 1,
    borderColor: C.line,
    padding: 30,
    backgroundColor: "white",
    borderRadius: 18,
    alignItems: "center",
  },
});

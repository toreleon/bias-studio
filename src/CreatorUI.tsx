import React, { useEffect, useRef } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";
import {
  ArrowLeft,
  Bookmark,
  Grid2X2,
  House,
  LockKeyhole,
  Sparkles,
} from "lucide-react-native";
import { Art, T } from "./ui";
import { Collection, Reaction, title } from "./workspace";
import { useWorkspace } from "./WorkspaceProvider";
export const K = {
  ink: "#281D3B",
  muted: "#71667F",
  purple: "#6840CB",
  lime: "#D8F785",
  paper: "#FAF8F5",
  line: "#E8E1EC",
  lavender: "#EFE7FC",
};
export const v = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  page: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    padding: 22,
    paddingBottom: 32,
    gap: 22,
  },
  title: {
    fontFamily: "DMSans_800ExtraBold",
    fontSize: 32,
    letterSpacing: -1.2,
    lineHeight: 37,
    color: K.ink,
  },
  eyebrow: {
    fontFamily: "DMSans_700Bold",
    fontSize: 11,
    letterSpacing: 1.5,
    color: K.purple,
  },
  sub: { fontSize: 14, lineHeight: 22, color: K.muted },
  section: { fontFamily: "DMSans_700Bold", fontSize: 20, letterSpacing: -0.4 },
  card: {
    backgroundColor: "white",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: K.line,
    gap: 12,
  },
  input: {
    fontFamily: "DMSans_500Medium",
    fontSize: 15,
    color: K.ink,
    padding: 14,
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#D8CFE2",
    borderRadius: 14,
    backgroundColor: "white",
  },
  chip: {
    borderWidth: 1,
    borderColor: K.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
  },
  small: { fontSize: 12, lineHeight: 18, color: K.muted },
});
export function Action({
  label,
  onPress,
  secondary = false,
  disabled = false,
  icon: Icon,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: any;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingVertical: 13,
        paddingHorizontal: 18,
        borderRadius: 16,
        backgroundColor: secondary ? "#EEE7F7" : K.purple,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
        opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
      })}
    >
      {Icon && <Icon size={18} color={secondary ? K.purple : "white"} />}
      <T
        style={{
          fontSize: 14,
          fontFamily: "DMSans_700Bold",
          color: secondary ? K.purple : "white",
          textAlign: "center",
          flexShrink: 1,
        }}
      >
        {label}
      </T>
    </Pressable>
  );
}
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[
        v.chip,
        selected && { backgroundColor: K.ink, borderColor: K.ink },
      ]}
    >
      <T
        style={{
          color: selected ? "white" : K.ink,
          fontSize: 13,
          fontFamily: "DMSans_600SemiBold",
        }}
      >
        {label}
      </T>
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChange,
  maxLength = 64,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <View style={{ gap: 7 }}>
      <T style={v.small}>{label}</T>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor={K.muted}
        style={v.input}
      />
    </View>
  );
}
export function Shell({
  children,
  back,
  tab = true,
  footer,
  scrollKey,
}: {
  children: React.ReactNode;
  back?: () => void;
  tab?: boolean;
  footer?: React.ReactNode;
  scrollKey?: number;
}) {
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ y: 0, animated: false });
  }, [scrollKey]);
  const path = usePathname();
  const store = useWorkspace();
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: K.paper }}
      edges={["top", "bottom"]}
    >
      <View style={{ borderBottomWidth: 1, borderBottomColor: K.line }}>
        <View
          style={[
            v.row,
            {
              width: "100%",
              maxWidth: 720,
              alignSelf: "center",
              paddingHorizontal: 20,
              height: 66,
              justifyContent: "space-between",
            },
          ]}
        >
          <View style={v.row}>
            {back ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={back}
                style={{ padding: 12 }}
              >
                <ArrowLeft size={22} color={K.ink} />
              </Pressable>
            ) : (
              <View
                style={{
                  backgroundColor: K.ink,
                  padding: 10,
                  borderRadius: 13,
                  transform: [{ rotate: "-6deg" }],
                }}
              >
                <Sparkles color={K.lime} size={21} />
              </View>
            )}
            <T
              style={{
                fontFamily: "DMSans_800ExtraBold",
                fontSize: 21,
                letterSpacing: -1,
              }}
            >
              bias studio<T style={{ color: K.purple }}> ✦</T>
            </T>
          </View>
          <LockKeyhole color={K.muted} size={16} />
        </View>
      </View>
      <ScrollView
        ref={scroller}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={v.page}>{children}</View>
      </ScrollView>
      {footer && (
        <View
          style={{
            paddingHorizontal: 22,
            paddingTop: 12,
            width: "100%",
            maxWidth: 720,
            alignSelf: "center",
            borderTopWidth: 1,
            borderTopColor: K.line,
          }}
        >
          {footer}
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={store.status}
        onPress={() => store.run("Saving your workspace…", store.flush)}
        style={{
          padding: 9,
          backgroundColor: store.status.startsWith("Not") ? "#FFF0DB" : K.paper,
        }}
      >
        <T
          accessibilityLiveRegion="polite"
          style={{
            fontSize: 11,
            color: store.status.startsWith("Not") ? "#92421A" : K.muted,
            textAlign: "center",
          }}
        >
          {store.status.startsWith("Saved") ? "✓ " : ""}
          {store.status}
        </T>
      </Pressable>
      {tab && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: K.line,
            backgroundColor: "white",
          }}
        >
          <View
            style={[
              v.row,
              {
                justifyContent: "space-around",
                maxWidth: 720,
                width: "100%",
                alignSelf: "center",
                padding: 8,
              },
            ]}
          >
            {[
              { href: "/", label: "Home", icon: House },
              { href: "/library", label: "Library", icon: Bookmark },
              { href: "/packs", label: "Packs", icon: Grid2X2 },
            ].map((n) => (
              <Pressable
                key={n.href}
                accessibilityRole="tab"
                accessibilityLabel={n.label}
                accessibilityState={{ selected: path === n.href }}
                onPress={() => router.navigate(n.href as any)}
                style={{
                  alignItems: "center",
                  gap: 4,
                  minWidth: 80,
                  minHeight: 48,
                  padding: 6,
                  borderRadius: 14,
                  backgroundColor: path === n.href ? K.lavender : "white",
                }}
              >
                <n.icon
                  color={path === n.href ? K.purple : K.muted}
                  size={21}
                />
                <T
                  style={{
                    fontSize: 11,
                    color: path === n.href ? K.purple : K.muted,
                    fontFamily: "DMSans_700Bold",
                  }}
                >
                  {n.label}
                </T>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
export function PackCard({ pack }: { pack: Collection }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${title(pack)}`}
      onPress={() => router.push(`/pack/${pack.id}`)}
      style={v.card}
    >
      <View
        style={{
          flexDirection: "row",
          height: 112,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: K.lavender,
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {pack.items.length ? (
          pack.items.slice(0, 3).map((item, i) => (
            <View
              key={item.id}
              style={{
                marginHorizontal: -6,
                transform: [{ rotate: `${(i - 1) * 8}deg` }],
              }}
            >
              <Art design={item.design} size={115} />
            </View>
          ))
        ) : (
          <T style={v.sub}>Your next reaction starts here ✦</T>
        )}
      </View>
      <View style={[v.row, { justifyContent: "space-between" }]}>
        <View style={{ flex: 1 }}>
          <T style={{ fontSize: 17, fontFamily: "DMSans_700Bold" }}>
            {title(pack)}
          </T>
          <T style={v.small}>
            {pack.items.length} reactions ·{" "}
            {pack.publisher ? `by ${pack.publisher}` : "Private draft"}
          </T>
        </View>
        <T style={{ color: K.purple, fontSize: 22 }}>↗</T>
      </View>
    </Pressable>
  );
}
export function ReactionTile({
  item,
  selected,
  onPress,
  label,
  children,
}: {
  item: Reaction;
  selected?: boolean;
  onPress: () => void;
  label?: string;
  children?: React.ReactNode;
}) {
  return (
    <View
      style={{
        width: "48%",
        flexGrow: 1,
        maxWidth: "49%",
        backgroundColor: selected ? K.lavender : "white",
        borderRadius: 20,
        borderWidth: 2,
        borderColor: selected ? K.purple : K.line,
        padding: 10,
        gap: 4,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          label ||
          `Select ${item.design.caption || item.source?.name || "reaction"}`
        }
        accessibilityState={{ selected: !!selected }}
        onPress={onPress}
        style={{ alignItems: "center", minHeight: 140 }}
      >
        <Art design={item.design} size={135} />
        <T
          numberOfLines={1}
          style={{
            fontFamily: "DMSans_600SemiBold",
            fontSize: 12,
            textAlign: "center",
          }}
        >
          {item.design.caption || item.source?.name || "Add a caption"}
        </T>
        {item.provenance?.kind === "generated" && (
          <T style={{ fontSize: 10, color: K.purple }}>AI GENERATED</T>
        )}
        {item.source?.seconds !== undefined && (
          <T style={v.small}>{item.source.seconds.toFixed(1)}s</T>
        )}
      </Pressable>
      {children}
    </View>
  );
}
export function Journey({ step }: { step: number }) {
  return (
    <View style={[v.row, { gap: 5 }]}>
      {["Moments", "Style", "Refine", "Share"].map((label, i) => (
        <View key={label} style={{ flex: 1, gap: 6 }}>
          <View
            style={{
              height: 4,
              borderRadius: 2,
              backgroundColor: i <= step ? K.purple : K.line,
            }}
          />
          <T
            style={{
              fontSize: 11,
              color: i === step ? K.purple : K.muted,
              fontFamily: i === step ? "DMSans_700Bold" : "DMSans_400Regular",
            }}
          >
            {i + 1} {label}
          </T>
        </View>
      ))}
    </View>
  );
}

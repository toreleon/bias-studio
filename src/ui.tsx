import React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { StickerDesign } from "./domain";
import { scene } from "./scene";
export function T({ style, ...props }: React.ComponentProps<typeof Text>) {
  return (
    <Text
      {...props}
      style={[{ fontFamily: "DMSans_400Regular", color: "#281D3B" }, style]}
    />
  );
}
export function Button({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: "#6840CB",
        borderRadius: 16,
        padding: 15,
        minHeight: 48,
        alignItems: "center",
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <T style={{ color: "white", fontFamily: "DMSans_700Bold" }}>{label}</T>
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
  style?: React.ComponentProps<typeof View>["style"];
}) {
  const identifier = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: size, height: size }, style]}
    >
      <SvgXml
        xml={scene(design, undefined, identifier, Platform.OS)}
        width="100%"
        height="100%"
      />
    </View>
  );
}

import React from "react";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  DMSans_800ExtraBold,
} from "@expo-google-fonts/dm-sans";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { WorkspaceProvider } from "../WorkspaceProvider";
export default function Layout() {
  const [fonts, error] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSans_800ExtraBold,
  });
  if (!fonts && !error)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <WorkspaceProvider>
        <Stack
          screenOptions={{ headerShown: false, animation: "slide_from_right" }}
        />
      </WorkspaceProvider>
    </SafeAreaProvider>
  );
}

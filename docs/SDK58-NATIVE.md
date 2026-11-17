# SDK 58 native toolchain verification

This upgrade retains the required quality, browser, Android, iOS, and aggregate CI gates. It does not change release approval, exact-source artifact manifests, checksums, or physical-device signoff requirements.

## Toolchain sources

The [Expo SDK 58 reference](https://docs.expo.dev/versions/v58.0.0/) lists React Native 0.88, Node 22.13.x or newer, Android compile SDK 37 / target SDK 36, iOS 16.4 or newer, and Xcode 26.4 or newer. The installed React Native 0.88.1 catalog (`node_modules/react-native/gradle/libs.versions.toml`) specifies Android Build Tools 37.0.0, NDK 27.1.12297006, and Android Gradle Plugin 9.2.1. Expo's regenerated Android wrapper selects Gradle 9.4.1.

[Android Gradle Plugin 9.2 compatibility](https://developer.android.com/build/releases/agp-9-2-0-release-notes) specifies JDK 17 and Gradle 9.4.1. CI therefore keeps JDK 17. `actions/setup-node`'s existing Node 22 selection resolves a supported current Node 22 patch.

The SDK platform package is named **`platforms;android-37.0`**, not `platforms;android-37`. The latter fails with “Failed to find package” in the current SDK repository. Both the release platform and Build Tools 37.0.0 were discovered with `sdkmanager --list --channel=3` and then installed using the normal stable-channel installation command.

CI installs both CMake 3.22.1 (the Android Gradle Plugin default used by native modules) and 3.30.5 (React Native 0.88.1's source-build default in `ReactAndroid/build.gradle.kts`). It does not override package build scripts or suppress native checks.

The [GitHub macOS 26 image manifest](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-Readme.md), inspected on 2026-11-18 (client local date), lists Xcode 26.4.1 at `/Applications/Xcode_26.4.1.app`. CI uses `macos-26` and explicitly selects that developer directory instead of relying on the runner's changing default Xcode. The existing Release Simulator build remains unsigned and cannot be installed on a physical iPhone.

## Local validation

The SDK 58 local Android check uses the existing JDK 17, Android SDK, and Gradle cache in the workspace, with the environment's proxy and normal trusted Java certificate store. TLS verification remains enabled. No generated Android or iOS file is manually edited.

- Android SDK platform 37.0, Build Tools 37.0.0, and CMake 3.30.5 installed successfully. NDK 27.1.12297006 and CMake 3.22.1 were already available.
- Workflow syntax/security validation passed with the existing pinned actionlint/zizmor checks.
- Android ARM64 Release compilation and release lint passed on 2026-11-18 (client local date): `:app:assembleRelease :app:lintVitalRelease`, 968 executed tasks, 14 minutes 49 seconds. The custom `fan-stickers` module compiled successfully, and R8 minification remained enabled. No native module source changes or generated-project patches were needed.
- The resulting local APK is `android/app/build/outputs/apk/release/app-release.apk` (46,649,994 bytes). Build Tools 37.0.0 `apksigner verify --verbose` passed (APK Signature Scheme v2). SHA-256: `54be016515841e328d7b094b66cf52723b84b35aafcdc11856984ea118c12571`. This is a debug-key-signed test APK, not a store release or proof of real-device installation.
- Lint and TypeScript checks passed after the SDK upgrade. Upstream Gradle/Android API deprecation warnings remain; the build does not suppress native failures or disable release lint.
- iOS native compilation requires the macOS CI runner. This Linux workspace cannot execute Xcode. A green simulator build still does not verify real-device WhatsApp handoff or person segmentation.

Expo Go can exercise the JavaScript workspace and Expo-bundled modules after the SDK alignment. The custom `fan-stickers` module is not part of Expo Go; native person cutout and WhatsApp pack installation continue to require a development/standalone build and physical-device validation.

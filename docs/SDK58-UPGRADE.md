# Expo SDK 58 upgrade

Bias Studio now targets Expo SDK 58 for compatibility with the user's current Expo Go installation. The change is based on the creator beta and preserves the existing local workspace schema, migration backup and release gates.

## Changes

- Expo 58.0.26, React Native 0.88.1 and React 19.3.0, with SDK-compatible Expo libraries and TypeScript 6.
- Native refs use component instance types required by React Native's strict TypeScript API.
- Ref updates happen after commit. Slider prop synchronization and collection loading follow the current React hooks rules without disabling lint checks.
- Splash configuration uses `expo-splash-screen`. Removed obsolete `newArchEnabled` and `android.edgeToEdgeEnabled` settings.
- Explicit `web.output: "single"` preserves the existing browser SPA and static preview workflow.
- Node types are an explicit development dependency for the existing test suite.
- Native CI toolchains are updated for SDK 58; see [native verification](SDK58-NATIVE.md).

Use Node 22.16 or later, install the lockfile with `npm ci`, and regenerate native projects before rebuilding. Existing SDK 54 development builds cannot load the SDK 58 app; rebuild them. Preserve application data and the original v1 migration backup when upgrading. No storage reset or new data migration is required.

## Expo Go preview

```bash
npm ci
npx expo start --go --lan
```

For a remote server, the phone needs a reachable HTTPS tunnel. A LAN address inside the cloud workspace is insufficient. The current preview uses a temporary tunnel; its QR and URL are session artifacts rather than permanent deployment addresses.

Expo Go previews local editing, drafts and the reusable library. WhatsApp handoff and automatic person cutout use the custom `FanStickers` native module and require a newly built development app. Online generation and distribution also need a configured reachable backend. Opening the preview does not install a sticker pack or validate a physical-device workflow.

## Verification

- Expo Doctor: 20/20 checks passed with normal proxy/CA configuration.
- Zero-warning lint and TypeScript checks passed.
- Existing 32 TypeScript tests, 43 server tests and 8 release-policy tests passed.
- All 22 browser workflows passed, including reopening, independent second-pack reuse, video-frame selection, export recovery and privacy boundaries.
- Production browser export passed with SPA output.
- The public preview manifest reports `exposdk:58.0.0`; its iOS bundle is checked separately through the temporary tunnel.
- Native build results are recorded in [SDK58-NATIVE.md](SDK58-NATIVE.md). Historical beta artifacts and their SDK 54 results remain valid only for their original source revision.

Physical iPhone/Android add-and-send checks remain necessary. No paid generation, production deployment or store release is part of this upgrade.

## References

- [SDK 58 release notes](https://expo.dev/changelog/sdk-58)
- [SDK upgrade guide](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
- [SDK 58 reference](https://docs.expo.dev/versions/v58.0.0/)

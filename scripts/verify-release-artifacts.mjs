import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

mkdirSync("release", { recursive: true });
const expected = [
  ["incoming/android", "android-test", "bias-studio-arm64-test.apk"],
  ["incoming/ios", "ios-simulator", "bias-studio-ios-simulator.zip"],
  ["incoming/web", "web", "bias-studio-web-preview.zip"],
];
const version = JSON.parse(readFileSync("app.json", "utf8")).expo.version;
const manifests = [];
const checksums = [];
for (const [directory, kind, filename] of expected) {
  const manifest = JSON.parse(
    readFileSync(join(directory, "build-info.json"), "utf8"),
  );
  const bytes = readFileSync(join(directory, filename));
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (
    manifest.schema !== 1 ||
    manifest.kind !== kind ||
    manifest.artifact !== filename ||
    manifest.sha !== process.env.SOURCE_SHA ||
    manifest.version !== version ||
    String(manifest.runId) !== process.env.CI_RUN_ID ||
    String(manifest.runAttempt) !== process.env.CI_RUN_ATTEMPT ||
    manifest.bytes !== bytes.length ||
    manifest.sha256 !== digest
  )
    throw new Error(
      `Invalid source/version/checksum evidence for ${filename}.`,
    );
  copyFileSync(join(directory, filename), join("release", filename));
  checksums.push(`${digest}  ${filename}`);
  manifests.push(manifest);
}
writeFileSync("release/SHA256SUMS.txt", checksums.join("\n") + "\n");
writeFileSync(
  "release/build-evidence.json",
  JSON.stringify(manifests, null, 2) + "\n",
);
writeFileSync(
  "release-notes.md",
  `Test candidate ${process.env.RELEASE_TAG}\n\nSource commit: ${process.env.SOURCE_SHA}\nCI run: ${process.env.CI_RUN_ID}, attempt ${process.env.CI_RUN_ATTEMPT}\n\nThese are test artifacts, not production store binaries. The Android APK uses the template debug certificate. The iOS app is for Simulator only and cannot be installed on an iPhone.\n\nAll CI jobs passed for this commit, checksums were verified, the dispatcher confirmed physical-device smoke tests, and the release environment required human approval.\n`,
);
console.log(
  "Verified all three artifacts against their CI source, run, version, and SHA-256.",
);

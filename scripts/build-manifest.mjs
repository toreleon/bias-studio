import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const [kind, artifact] = process.argv.slice(2);
if (!["android-test", "ios-simulator", "web"].includes(kind) || !artifact) {
  throw new Error(
    "Usage: node scripts/build-manifest.mjs <android-test|ios-simulator|web> <artifact>",
  );
}
if (!/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA || ""))
  throw new Error("A source commit SHA is required.");
const app = JSON.parse(readFileSync("app.json", "utf8")).expo;
const bytes = readFileSync(artifact);
writeFileSync(
  join(dirname(artifact), "build-info.json"),
  JSON.stringify(
    {
      schema: 1,
      kind,
      sha: process.env.GITHUB_SHA,
      runId: process.env.GITHUB_RUN_ID,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT,
      version: app.version,
      artifact: basename(artifact),
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      distribution:
        kind === "android-test"
          ? "test APK signed with template debug key"
          : kind === "ios-simulator"
            ? "unsigned simulator app; not an iPhone install"
            : "browser preview",
    },
    null,
    2,
  ) + "\n",
);

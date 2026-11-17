import { test, expect, Page, Route } from "@playwright/test";
import fs from "node:fs/promises";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

const key = "bias-studio.workspace.v2";
const origin = "http://localhost:8787";
const remoteId = "a".repeat(36);
const invite = "fixture-sharing-invite";
const privatePrompt = "private-generation-description-do-not-publish";
const privateTag = "private-unannounced-fandom-project";

async function saved(page: Page) {
  await expect(page.getByRole("button", { name: "Saved on this device", exact: true })).toBeVisible();
}
async function preview(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Try a 3-reaction demo", exact: true }).click();
  await saved(page);
  const source = `data:image/png;base64,${(await fs.readFile("tests/fixtures/portrait.png")).toString("base64")}`;
  await page.evaluate(({ key, source, privatePrompt, privateTag }) => {
    const workspace = JSON.parse(localStorage.getItem(key)!);
    const pack = workspace.collections[0];
    pack.name = "Encore collection";
    pack.publisher = "@fandom-creator";
    pack.items.forEach((item: any) => {
      item.design.originalSource = source;
      item.tags.fandom = privateTag;
      item.source = { name: "private-source-video.mp4", seconds: 7.2 };
      item.provenance = { kind: "generated", prompt: privatePrompt, look: "soft", feeling: "love", model: "fixture" };
    });
    localStorage.setItem(key, JSON.stringify(workspace));
  }, { key, source, privatePrompt, privateTag });
  await page.reload();
  await page.getByRole("button", { name: "Preview in chat", exact: true }).click();
  await expect(page.getByText("Ready for the chat?", { exact: true })).toBeVisible();
}
async function download(page: Page, label: string) {
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: label, exact: true }).click();
  const file = await event;
  const bytes = await fs.readFile((await file.path())!);
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  return bytes;
}
async function connect(page: Page) {
  await page.getByRole("textbox", { name: "Sharing creator invite", exact: true }).fill(invite);
  await page.getByRole("button", { name: "Connect creator account", exact: true }).click();
  await expect(page.getByRole("button", { name: "Disconnect creator account", exact: true })).toBeVisible();
}

test("default pack download contains finished WebP only; editable sources require the explicit separate action", async ({ page }) => {
  await page.route(`${origin}/v1/config`, (route) => route.fulfill({ json: { publicPages: false, telegram: false } }));
  await preview(page);
  await expect(page.getByRole("button", { name: "Create editable pack file", exact: true })).toHaveCount(0);
  const bytes = await download(page, "Download pack file");
  const files = unzipSync(bytes);
  const manifest = JSON.parse(strFromU8(files["collection.json"]));
  expect(Object.keys(manifest).sort()).toEqual(["format", "id", "name", "publisher", "stickers", "version"]);
  expect(manifest.format).toBe("bias-studio-finished");
  expect(manifest.publisher).toBe("@fandom-creator");
  expect(manifest.stickers).toHaveLength(3);
  expect(Object.keys(files).sort()).toEqual(["READ-ME.txt", "collection.json", "stickers/01.webp", "stickers/02.webp", "stickers/03.webp"]);
  for (const file of manifest.stickers) {
    expect(Object.keys(file)).toEqual(["file"]);
    const encoded = Buffer.from(files[file.file]);
    expect(encoded.toString("ascii", 0, 4)).toBe("RIFF");
    expect(encoded.toString("ascii", 8, 12)).toBe("WEBP");
    expect(encoded.length).toBeLessThanOrEqual(102400);
  }
  const metadata = strFromU8(files["collection.json"]);
  for (const value of [privatePrompt, privateTag, "originalSource", "provenance", "private-source-video.mp4", "file://"])
    expect(metadata).not.toContain(value);
  await page.getByRole("button", { name: "Share editable source files…", exact: true }).click();
  await expect(page.getByText("This file includes original photos", { exact: false })).toBeVisible();
  const editable = unzipSync(await download(page, "Create editable pack file"));
  const sourceMetadata = strFromU8(editable["collection.json"]);
  expect(sourceMetadata).toContain(privatePrompt);
  expect(sourceMetadata).toContain(privateTag);
  expect(sourceMetadata).toContain("originalSource");
});

test("publishing sends finished images only; an anonymous recipient imports a real ZIP and unpublishing removes access", async ({ page, browser }) => {
  let published = false;
  let uploads = 0;
  let publishCalls = 0;
  let remoteExists = false;
  let zip: Uint8Array | undefined;
  let images: string[] = [];
  const remote = () => ({ id: remoteId, revision: 1, name: "Encore collection", publisher: "@fandom-creator", published,
    publicURL: published ? `https://beta.example/p/${remoteId}` : null, telegramURL: null, telegramStatus: "not_created" });
  const routePublic = async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    expect(request.headers().authorization).toBeUndefined();
    if (path === "/v1/config") return route.fulfill({ json: { publicPages: false, telegram: false } });
    if (!published) return route.fulfill({ status: 404, json: { error: "Unavailable" } });
    if (path === `/public/packs/${remoteId}`) return route.fulfill({ json: { ...remote(), stickers: images.map((_, index) => ({ imageURL: `${origin}/public/packs/${remoteId}/images/${index}`, emoji: "💜" })) } });
    if (path === `/public/packs/${remoteId}/download`) {
      expect(zip).toBeDefined();
      return route.fulfill({ contentType: "application/zip", body: Buffer.from(zip!) });
    }
    const image = /\/images\/(\d+)$/.exec(path);
    if (image) return route.fulfill({ contentType: "image/webp", body: Buffer.from(images[Number(image[1])].split(",")[1], "base64") });
    throw new Error(`Unexpected public request: ${path}`);
  };
  await page.route(`${origin}/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/v1/config") return route.fulfill({ json: { publicPages: true, telegram: false } });
    if (path === "/v1/session") {
      expect(request.postDataJSON()).toEqual({ code: invite });
      return route.fulfill({ json: { token: "bs_sess_sharing", expiresAt: Date.now() + 3600000, creator: { id: "creator-fixture", label: "Fixture creator", quota: 20 } } });
    }
    expect(request.headers().authorization).toBe("Bearer bs_sess_sharing");
    if (path === "/v1/packs" && request.method() === "GET") return route.fulfill({ json: remoteExists ? [remote()] : [] });
    if (path === "/v1/packs" && request.method() === "POST") {
      const body = request.postDataJSON();
      expect(Object.keys(body).sort()).toEqual(["clientId", "name", "publisher", "stickers"]);
      expect(body.clientId).toMatch(/^[a-zA-Z0-9-]{1,120}$/);
      expect(body.name).toBe("Encore collection");
      expect(body.publisher).toBe("@fandom-creator");
      expect(body.stickers).toHaveLength(3);
      for (const sticker of body.stickers) {
        expect(Object.keys(sticker).sort()).toEqual(["emoji", "image"]);
        expect(sticker.image).toMatch(/^data:image\/webp;base64,/);
      }
      for (const value of [privatePrompt, privateTag, "originalSource", "provenance", "private-source-video.mp4"])
        expect(JSON.stringify(body)).not.toContain(value);
      images = body.stickers.map((s: any) => s.image);
      uploads++;
      remoteExists = true;
      return route.fulfill({ json: remote() });
    }
    if (path === `/v1/packs/${remoteId}/publish`) {
      expect(request.method()).toBe("POST");
      expect(request.postDataJSON()).toEqual({ revision: 1 });
      expect(uploads).toBe(1);
      published = true;
      publishCalls++;
      return route.fulfill({ json: remote() });
    }
    if (path === `/v1/packs/${remoteId}/unpublish`) {
      expect(request.method()).toBe("POST");
      published = false;
      return route.fulfill({ json: remote() });
    }
    throw new Error(`Unexpected creator request: ${request.method()} ${path}`);
  });
  await preview(page);
  const localFiles = unzipSync(await download(page, "Download pack file"));
  const manifest = JSON.parse(strFromU8(localFiles["collection.json"]));
  manifest.id = remoteId;
  localFiles["collection.json"] = strToU8(JSON.stringify(manifest));
  zip = zipSync(localFiles, { level: 0 });
  await connect(page);
  await page.getByRole("button", { name: "Publish collection page…", exact: true }).click();
  expect(uploads).toBe(0);
  expect(publishCalls).toBe(0);
  await page.getByRole("button", { name: "Keep draft private", exact: true }).click();
  expect(uploads).toBe(0);
  await page.getByRole("button", { name: "Publish collection page…", exact: true }).click();
  await page.getByRole("button", { name: "Publish finished collection", exact: true }).click();
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open public collection page", exact: true })).toBeVisible();
  expect(publishCalls).toBe(1);
  const recipientContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
  try {
    const recipient = await recipientContext.newPage();
    await recipient.route(`${origin}/**`, routePublic);
    await recipient.goto(`/receive/${remoteId}`);
    await expect(recipient.getByText("Created by @fandom-creator · 3 reactions", { exact: true })).toBeVisible();
    await expect(recipient.getByRole("textbox", { name: /invite|access code/i })).toHaveCount(0);
    await recipient.getByRole("button", { name: "Save pack to Bias Studio", exact: true }).click();
    await expect(recipient.getByText("Saving is not installation.", { exact: false })).toBeVisible();
    await recipient.getByRole("button", { name: "Got it", exact: true }).click();
    await saved(recipient);
    const received = await recipient.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key);
    expect(received.collections).toHaveLength(1);
    expect(received.collections[0].origin).toEqual({ id: remoteId, creator: "@fandom-creator" });
    expect(received.collections[0].items.every((i: any) => i.design.flattened && !i.design.originalSource && !i.provenance)).toBe(true);
    expect(JSON.stringify(received)).not.toContain(privatePrompt);
    await page.getByRole("button", { name: "Unpublish Encore collection", exact: true }).click();
    await page.getByRole("button", { name: "Got it", exact: true }).click();
    await expect(page.getByRole("button", { name: "Open public collection page", exact: true })).toHaveCount(0);
    await recipient.goto(`/receive/${remoteId}`);
    await expect(recipient.getByText("This pack or job is unavailable.", { exact: false })).toBeVisible();
    await expect(recipient.getByRole("button", { name: "Save pack to Bias Studio", exact: true })).toHaveCount(0);
    expect(await recipient.evaluate((k) => JSON.parse(localStorage.getItem(k)!).collections.length, key)).toBe(1);
  } finally {
    await recipientContext.close();
  }
});

test("Telegram exposes an installation link only after verified creation, preserving the draft on failure", async ({ page }) => {
  let confirmed = 0;
  let uploads = 0;
  let verified = false;
  const remote = () => ({ id: remoteId, revision: uploads || 1, name: "Encore collection", publisher: "@fandom-creator", published: false,
    publicURL: null, telegramURL: verified ? "https://t.me/addstickers/fixture_by_bias_bot" : null,
    telegramStatus: verified ? "verified" : confirmed ? "uncertain" : "not_created" });
  await page.route(`${origin}/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/v1/config") return route.fulfill({ json: { publicPages: false, telegram: true } });
    if (path === "/v1/session") return route.fulfill({ json: { token: "bs_sess_sharing", expiresAt: Date.now() + 3600000, creator: { id: "creator-fixture", label: "Fixture creator", quota: 20 } } });
    expect(request.headers().authorization).toBe("Bearer bs_sess_sharing");
    if (path === "/v1/telegram/link") return route.fulfill({ json: { linked: true } });
    if (path === "/v1/packs" && request.method() === "GET") return route.fulfill({ json: uploads ? [remote()] : [] });
    if (path === "/v1/packs" && request.method() === "POST") {
      const body = request.postDataJSON();
      expect(Object.keys(body).sort()).toEqual(uploads ? ["id", "name", "publisher", "stickers"] : ["clientId", "name", "publisher", "stickers"]);
      if (uploads) expect(body.id).toBe(remoteId);
      expect(body.stickers).toHaveLength(3);
      expect(body.stickers.every((s: any) => /^data:image\/webp;base64,/.test(s.image))).toBe(true);
      expect(JSON.stringify(body)).not.toContain(privatePrompt);
      uploads++;
      return route.fulfill({ json: remote() });
    }
    if (path === `/v1/packs/${remoteId}/telegram`) {
      expect(request.method()).toBe("POST");
      expect(request.postDataJSON()).toEqual({ revision: uploads });
      confirmed++;
      if (confirmed === 1) return route.fulfill({ json: { status: "uncertain", url: "https://t.me/addstickers/unverified_by_bias_bot" } });
      verified = true;
      return route.fulfill({ json: { status: "verified", name: "fixture_by_bias_bot", url: remote().telegramURL } });
    }
    throw new Error(`Unexpected Telegram request: ${path}`);
  });
  await preview(page);
  const before = await page.evaluate((k) => localStorage.getItem(k), key);
  await connect(page);
  await expect(page.getByRole("button", { name: "Publish collection page…", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Create Telegram sticker set…", exact: true }).click();
  expect(confirmed).toBe(0);
  expect(uploads).toBe(0);
  await page.getByRole("button", { name: "Confirm Telegram export", exact: true }).click();
  await expect(page.getByText("Telegram has not confirmed this set.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open Telegram sticker set", exact: true })).toHaveCount(0);
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(before);
  await page.getByRole("button", { name: "Refresh my cloud copies", exact: true }).click();
  await page.getByRole("button", { name: "Check Telegram export for Encore collection", exact: true }).click();
  await expect(page.getByText("The existing Telegram set is verified.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open Telegram sticker set", exact: true })).toBeVisible();
  expect(confirmed).toBe(2);
  expect(uploads).toBe(1);
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(before);
});

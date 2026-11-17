import { test, expect, Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";

const fixtures = path.join(__dirname, "../fixtures");
async function home(page: Page) {
  await page.goto("/");
  await expect(
    page.getByText("A little bias. A lot of expression."),
  ).toBeVisible();
}
async function save(page: Page, name?: string) {
  await page.getByRole("button", { name: "Save sticker", exact: true }).click();
  if (name) await page.getByRole("textbox", { name: "Pack name" }).fill(name);
  await page.getByRole("button", { name: "Save to pack", exact: true }).click();
  await expect(
    page.getByText("A new favorite, saved to your pack."),
  ).toBeVisible();
}
async function importFile(page: Page, button: string, file: string) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: button, exact: true }).click();
  await (await chooser).setFiles(path.join(fixtures, file));
  await expect(page.getByText("Make it yours", { exact: true })).toBeVisible();
}
test("create three stickers, persist a pack, download a transparent 512px WebP and explain native export", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await home(page);
  await page.getByRole("button", { name: "Remix love sticker" }).click();
  await page.getByRole("tab", { name: "Caption", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Sticker caption" })
    .fill("my comfort person");
  await page.screenshot({
    path: testInfo.outputPath("editor.png"),
    fullPage: true,
  });
  await save(page, "Comfort person");
  await expect(
    page.getByRole("button", { name: "Add to WhatsApp" }),
  ).toBeDisabled();
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Try a demo sticker" }).click();
    await save(page);
  }
  await expect(
    page.getByRole("button", { name: "Add to WhatsApp" }),
  ).toBeEnabled();
  await page.reload();
  await page.getByRole("tab", { name: "My packs" }).click();
  await page.getByRole("button", { name: "Open Comfort person" }).click();
  await expect(
    page.getByText("3 / 30 stickers · Made by you, for the group chat."),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("pack.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Add to WhatsApp" }).click();
  await expect(
    page.getByText(
      "WhatsApp pack export is available in the native iPhone and Android builds.",
      { exact: false },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Got it" }).click();
  await page
    .getByRole("button", { name: "View sticker my comfort person" })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download sticker" }).click();
  const file = await (await download).path();
  const bytes = await fs.readFile(file!);
  expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
  expect(bytes.toString("ascii", 8, 12)).toBe("WEBP");
  expect(bytes.length).toBeLessThanOrEqual(102400);
  const pixels = await page.evaluate(async () => {
    const library = JSON.parse(localStorage.getItem("bias-studio.library.v1")!);
    const image = new Image();
    image.src = library.packs[0].stickers[0].uri;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    return {
      w: image.width,
      h: image.height,
      cornerAlpha: ctx.getImageData(0, 0, 1, 1).data[3],
      centerAlpha: ctx.getImageData(256, 210, 1, 1).data[3],
    };
  });
  expect(pixels).toEqual({ w: 512, h: 512, cornerAlpha: 0, centerAlpha: 255 });
  expect(errors).toEqual([]);
});
test("photo import supports crop, frames, captions and a real image export", async ({
  page,
}) => {
  await home(page);
  await importFile(page, "Create from photo", "portrait.png");
  await page.getByRole("button", { name: "circle frame" }).click();
  await page.getByRole("tab", { name: "Crop", exact: true }).click();
  const zoom = page.getByRole("slider", { name: "Zoom" });
  await zoom.focus();
  await zoom.press("ArrowRight");
  await expect(zoom).toHaveValue("1.05");
  await page.getByRole("tab", { name: "Caption", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Sticker caption" })
    .fill("best day ever");
  await save(page, "Concert mood");
  const pixels = await page.evaluate(async () => {
    const library = JSON.parse(localStorage.getItem("bias-studio.library.v1")!);
    const image = new Image();
    image.src = library.packs[0].stickers[0].uri;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    return Array.from(ctx.getImageData(256, 220, 1, 1).data);
  });
  expect(pixels[3]).toBe(255);
  expect(pixels[0]).toBeGreaterThan(100);
});
test("video import selects a later frame and makes a still sticker", async ({
  page,
}) => {
  await home(page);
  await importFile(page, "Create from video", "moment.mp4");
  await expect(
    page.getByText("Choose a frame to make a still sticker."),
  ).toBeVisible();
  const slider = page.getByRole("slider", { name: "Video frame time" });
  await slider.focus();
  await slider.press("End");
  await expect(page.getByText("1.9s / 2.0s")).toBeVisible();
  await save(page, "Iconic moments");
  const pixel = await page.evaluate(async () => {
    const l = JSON.parse(localStorage.getItem("bias-studio.library.v1")!);
    const i = new Image();
    i.src = l.packs[0].stickers[0].uri;
    await i.decode();
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(i, 0, 0);
    return Array.from(ctx.getImageData(256, 220, 1, 1).data);
  });
  expect(pixel[2]).toBeGreaterThan(pixel[0] + 30);
  expect(pixel[3]).toBe(255);
});
test("mobile layout fits the viewport and the editor saves without horizontal overflow", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await home(page);
  await expect(page.getByRole("tab", { name: "Workshop" })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("mobile-home.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "Remix happy sticker" }).click();
  await page.screenshot({
    path: testInfo.outputPath("mobile-editor.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await save(page, "Tiny feelings");
  await page
    .getByRole("button", { name: "View sticker you did that!" })
    .click();
  await page.getByRole("button", { name: "Remove from pack" }).click();
  await page
    .getByRole("button", { name: "Remove sticker", exact: true })
    .click();
  await expect(page.getByText("Sticker removed.")).toBeVisible();
});
test("storage errors preserve the unsaved draft and show a recoverable error", async ({
  page,
}) => {
  await home(page);
  await page.getByRole("button", { name: "Remix love sticker" }).click();
  await page.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw new Error(
        "Device storage is full. Free up some space and try again.",
      );
    };
  });
  await page.getByRole("button", { name: "Save sticker", exact: true }).click();
  await page.getByRole("button", { name: "Save to pack", exact: true }).click();
  await expect(
    page.getByText("Device storage is full. Free up some space and try again."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Got it" }).click();
  await page.getByRole("button", { name: "Close pack dialog" }).click();
  await expect(page.getByText("Make it yours", { exact: true })).toBeVisible();
});
test("an unreadable saved library is preserved and cannot be overwritten by an empty shelf", async ({
  page,
}) => {
  await home(page);
  await page.evaluate(() =>
    localStorage.setItem("bias-studio.library.v1", "{damaged library"),
  );
  await page.reload();
  await expect(
    page.getByText(
      "Your saved library could not be read. It has been kept intact.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "New pack", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("bias-studio.library.v1")),
  ).toBe("{damaged library");
});

import { test, expect } from "@playwright/test";

test("detailed transparent photos are compact before autosave and survive library saving and reopening", async ({ page }) => {
  await page.goto("/");
  // An actual noisy image exercises compression and browser storage; tiny
  // fixtures cannot reproduce the capacity problem of camera-sized photos.
  const original = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1200;
    const context = canvas.getContext("2d")!;
    const pixels = context.createImageData(1200, 1200);
    let random = 12345;
    for (let y = 100; y < 1100; y++) {
      for (let x = 100; x < 1100; x++) {
        const offset = (y * 1200 + x) * 4;
        for (let channel = 0; channel < 3; channel++) {
          random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
          pixels.data[offset + channel] = random >>> 24;
        }
        pixels.data[offset + 3] = 255;
      }
    }
    context.putImageData(pixels, 0, 0);
    return canvas.toDataURL("image/png");
  });
  expect(original.length).toBeGreaterThan(2_000_000);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import photos", exact: true }).click();
  await (await chooser).setFiles(Array.from({ length: 3 }, (_, i) => ({
    name: `detailed-${i}.png`,
    mimeType: "image/png",
    buffer: Buffer.from(original.split(",")[1], "base64"),
  })));
  await expect(page.getByText("3 / 30 REACTIONS · PRIVATE DRAFT")).toBeVisible();
  await expect(page.getByRole("button", { name: "Saved on this device", exact: true })).toBeVisible();
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem("bias-studio.workspace.v2")!;
    return { length: raw.length, source: JSON.parse(raw).collections[0].items[0].design.source as string };
  });
  expect(stored.length).toBeLessThan(1_000_000);
  expect(stored.source).toMatch(/^data:image\/webp;base64,/);
  expect(stored.source.length).toBeLessThanOrEqual(128 * 1024);
  const decoded = await page.evaluate(async (source) => {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    return {
      width: image.width,
      height: image.height,
      cornerAlpha: context.getImageData(0, 0, 1, 1).data[3],
      centerAlpha: context.getImageData(image.width / 2, image.height / 2, 1, 1).data[3],
    };
  }, stored.source);
  expect(decoded.width).toBeGreaterThanOrEqual(512);
  expect(decoded.width).toBeLessThanOrEqual(1200);
  expect(decoded.height).toBe(decoded.width);
  expect(decoded.cornerAlpha).toBe(0);
  expect(decoded.centerAlpha).toBe(255);
  await page.getByRole("button", { name: "Save to library", exact: true }).click();
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await expect(page.getByRole("button", { name: "Saved on this device", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("3 / 30 REACTIONS · PRIVATE DRAFT")).toBeVisible();
  const reopened = await page.evaluate(() => JSON.parse(localStorage.getItem("bias-studio.workspace.v2")!));
  expect(reopened.assets).toHaveLength(3);
  expect(reopened.assets[0].design.source).toBe(stored.source);
  expect(reopened.collections[0].items[0].design.source).toBe(stored.source);
});

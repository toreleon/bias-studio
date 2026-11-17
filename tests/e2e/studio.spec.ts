import { test, expect, Page } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { unzipSync } from "fflate";
import { scene } from "../../src/scene";
import { defaultDesign } from "../../src/domain";
const fixtures = path.join(process.cwd(), "tests/fixtures");
const key = "bias-studio.workspace.v2";
async function home(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Start a reaction pack", exact: true }),
  ).toBeVisible();
}
async function saved(page: Page) {
  await expect(
    page.getByRole("button", { name: "Saved on this device", exact: true }),
  ).toBeVisible();
}
async function state(page: Page) {
  await saved(page);
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key);
}
async function photos(page: Page, count = 3) {
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Import photos", exact: true })
    .click();
  const buffer = await fs.readFile(path.join(fixtures, "portrait.png"));
  await (
    await chooser
  ).setFiles(
    Array.from({ length: count }, (_, i) => ({
      name: `moment-${i + 1}.png`,
      mimeType: "image/png",
      buffer,
    })),
  );
  await expect(
    page.getByText(`${count} / 30 REACTIONS · PRIVATE DRAFT`),
  ).toBeVisible();
}
async function demo(page: Page) {
  await home(page);
  await page.getByRole("button", { name: "Try a 3-reaction demo" }).click();
  await expect(
    page.getByText("3 / 30 REACTIONS · PRIVATE DRAFT"),
  ).toBeVisible();
}
async function download(page: Page) {
  await page
    .getByRole("button", { name: "Download pack file", exact: true })
    .click();
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Create editable pack file" }).click();
  const d = await event;
  await page.getByRole("button", { name: "Got it" }).click();
  return await fs.readFile((await d.path())!);
}

test("acceptance: import a pack, style and tag it, reopen, then reuse reactions and a saved style in a second pack", async ({
  page,
}) => {
  await home(page);
  await photos(page);
  await page
    .getByRole("button", { name: "Style selected", exact: true })
    .click();
  await page.getByRole("button", { name: "Editorial", exact: true }).click();
  await page.getByRole("button", { name: "Top caption" }).click();
  await page
    .getByRole("textbox", { name: "Style name", exact: true })
    .fill("Encore lilac");
  await page.getByRole("button", { name: "Save reusable style" }).click();
  await page.getByRole("button", { name: "Got it" }).click();
  await page.getByRole("button", { name: "Close pack styling" }).click();
  await page
    .getByRole("button", { name: "Organize selected reactions" })
    .click();
  await page
    .getByRole("textbox", { name: "Fandom", exact: true })
    .fill("Aurora");
  await page
    .getByRole("textbox", { name: "Emotion", exact: true })
    .fill("hype");
  await page
    .getByRole("button", { name: "Save to library", exact: true })
    .click();
  await page.getByRole("button", { name: "Got it" }).click();
  await page.getByRole("button", { name: "Name & creator credit" }).click();
  await page
    .getByRole("textbox", { name: "Pack name", exact: true })
    .fill("Encore energy");
  await page
    .getByRole("textbox", { name: "Creator credit", exact: true })
    .fill("@luna");
  await saved(page);
  const first = await state(page);
  expect(first.collections[0].items).toHaveLength(3);
  expect(
    first.collections[0].items.every((i: any) => i.design.font === "serif"),
  ).toBe(true);
  await page.reload();
  await expect(page.getByText("Encore energy", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Library", exact: true }).click();
  await page.getByRole("textbox", { name: "Search reactions" }).fill("aurora");
  await page.getByRole("button", { name: "hype", exact: true }).click();
  await page.getByRole("button", { name: "Select visible" }).click();
  await page.getByRole("button", { name: "New pack from 3 reactions" }).click();
  await page.getByRole("button", { name: "Style whole pack" }).click();
  await page.getByRole("button", { name: "Use Encore lilac" }).click();
  const second = await state(page);
  expect(second.collections).toHaveLength(2);
  expect(second.collections[0].items).toHaveLength(3);
  expect(second.collections[0].items[0].id).not.toBe(
    first.collections[0].items[0].id,
  );
  expect(second.collections[0].items[0].design.source).toBe(
    first.collections[0].items[0].design.source,
  );
  expect(second.collections[0].items[0].design.font).toBe("serif");
});

test("multi-frame selection preserves distinct frames and timestamps after reopening", async ({
  page,
}) => {
  await home(page);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Pick video frames" }).click();
  await (await chooser).setFiles(path.join(fixtures, "moment.mp4"));
  await expect(page.getByText("Every frame, a feeling.")).toBeVisible();
  await page.getByRole("button", { name: "Frame 0.0s", exact: true }).click();
  await page.getByRole("button", { name: "Frame 1.0s", exact: true }).click();
  const slider = page.getByRole("slider", { name: "Video frame time" });
  await slider.focus();
  await slider.press("End");
  await page
    .getByRole("button", { name: "Keep frame at 1.9s", exact: true })
    .click();
  await page.getByRole("button", { name: "Add 3 frames to pack" }).click();
  const w = await state(page);
  expect(w.collections[0].items.map((i: any) => i.source.seconds)).toEqual([
    0, 1, 1.9,
  ]);
  expect(w.collections[0].items[0].design.source).not.toBe(
    w.collections[0].items[2].design.source,
  );
  await page.reload();
  await expect(page.getByText("1.9s", { exact: true })).toBeVisible();
});

test("individual override, manual erase and restore, undo and reorder survive save", async ({
  page,
}) => {
  await home(page);
  await photos(page, 2);
  await page.getByRole("button", { name: "Refine 1", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Sticker caption" })
    .fill("my comfort person");
  await page.getByRole("button", { name: "Style", exact: true }).click();
  await page.getByRole("button", { name: "Typewriter", exact: true }).click();
  await page.getByRole("button", { name: "Cutout", exact: true }).click();
  await page.getByRole("button", { name: "Correct edges manually" }).click();
  const canvas = page.getByLabel("Cutout correction canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 12,
    box.y + box.height / 2 + 12,
  );
  await page.mouse.up();
  await saved(page);
  expect(
    (await state(page)).collections[0].items[0].design.strokes,
  ).toHaveLength(1);
  await page.getByRole("button", { name: "Restore brush" }).click();
  await canvas.scrollIntoViewIfNeeded();
  const b = (await canvas.boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  expect(
    (await state(page)).collections[0].items[0].design.strokes,
  ).toHaveLength(2);
  await page.getByRole("button", { name: "Undo last brush stroke" }).click();
  expect(
    (await state(page)).collections[0].items[0].design.strokes,
  ).toHaveLength(1);
  await page.getByRole("button", { name: "Done refining" }).click();
  await page
    .getByRole("button", { name: "Move reaction 1 later", exact: true })
    .click();
  const result = await state(page);
  expect(result.collections[0].items[1].design.caption).toBe(
    "my comfort person",
  );
  expect(result.collections[0].items[0].design.caption).toBe("");
  expect(result.collections[0].items[1].design.font).toBe("mono");
});

test("pack sharing exports real 512px WebP files and reimports editable credit-bearing collections", async ({
  page,
}) => {
  await demo(page);
  await page.getByRole("button", { name: "Preview in chat" }).click();
  await page
    .getByRole("textbox", { name: "Pack name", exact: true })
    .fill("Comfort club");
  await page
    .getByRole("textbox", { name: "Creator credit", exact: true })
    .fill("@nova");
  await expect(
    page.getByRole("button", { name: "Add to WhatsApp" }),
  ).toHaveCount(0);
  const bytes = await download(page);
  const zip = unzipSync(bytes);
  expect(Object.keys(zip).filter((k) => k.endsWith(".webp"))).toHaveLength(3);
  const webp = Buffer.from(zip["stickers/01.webp"]);
  expect(webp.toString("ascii", 0, 4)).toBe("RIFF");
  expect(webp.toString("ascii", 8, 12)).toBe("WEBP");
  expect(webp.length).toBeLessThanOrEqual(102400);
  const pixels = await page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/webp;base64,${data}`;
    await image.decode();
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    return {
      w: image.width,
      h: image.height,
      corner: ctx.getImageData(0, 0, 1, 1).data[3],
      center: ctx.getImageData(256, 210, 1, 1).data[3],
    };
  }, webp.toString("base64"));
  expect(pixels).toEqual({ w: 512, h: 512, corner: 0, center: 255 });
  await page.goto("/packs");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import pack file" }).click();
  await (
    await chooser
  ).setFiles({
    name: "comfort.zip",
    mimeType: "application/zip",
    buffer: bytes,
  });
  await expect(
    page.getByText("Comfort club", { exact: true }).last(),
  ).toBeVisible();
  const w = await state(page);
  expect(w.collections).toHaveLength(2);
  expect(w.collections[0].publisher).toBe("@nova");
  expect(w.collections[0].origin.creator).toBe("@nova");
  expect(w.collections[0].items[0].design.caption).toBe("my whole heart");
});

test("legacy migration keeps the old key and packs readable without inventing editable layers", async ({
  page,
}) => {
  await home(page);
  const uri =
    "data:image/png;base64," +
    (await fs.readFile(path.join(fixtures, "portrait.png"))).toString("base64");
  const legacy = {
    version: 1,
    packs: [
      {
        id: "legacy-pack",
        name: "Old favorites",
        publisher: "@original",
        color: "#A28AF0",
        updatedAt: 4,
        stickers: [
          {
            id: "old-sticker",
            uri,
            bytes: 123,
            width: 512,
            height: 512,
            caption: "baked caption",
            createdAt: 3,
          },
        ],
      },
    ],
  };
  await page.evaluate((old) => {
    localStorage.removeItem("bias-studio.workspace.v2");
    localStorage.setItem("bias-studio.library.v1", JSON.stringify(old));
  }, legacy);
  await page.reload();
  await page.getByRole("button", { name: "Open Old favorites" }).click();
  await page.getByRole("button", { name: "Refine 1" }).click();
  await expect(
    page.getByText("Imported from the original MVP.", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("bias-studio.library.v1")!),
    ),
  ).toEqual(legacy);
  expect((await state(page)).collections[0].items[0].design.source).toBe(uri);
});

test("storage failure leaves the draft in memory and retry persists it", async ({
  page,
}) => {
  await demo(page);
  await saved(page);
  await page.evaluate(() => {
    (window as any).originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function () {
      throw new Error("Device storage is full. Free some space and retry.");
    };
  });
  await page.getByRole("button", { name: "Refine 1" }).click();
  await page
    .getByRole("textbox", { name: "Sticker caption" })
    .fill("still here");
  await expect(
    page.getByRole("button", { name: "Not saved · tap to retry" }),
  ).toBeVisible();
  await page.evaluate(() => {
    Storage.prototype.setItem = (window as any).originalSet;
  });
  await page.getByRole("button", { name: "Not saved · tap to retry" }).click();
  await saved(page);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Sticker caption" }),
  ).toHaveValue("still here");
});

test("export failure preserves drafts and a retry produces a pack file", async ({
  page,
}) => {
  await demo(page);
  await page.getByRole("button", { name: "Preview in chat" }).click();
  const before = await state(page);
  await page.evaluate(() => {
    (window as any).originalCanvas = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function () {
      throw new Error("Image export failed. Please try again.");
    };
  });
  await page.getByRole("button", { name: "Download pack file" }).click();
  await page.getByRole("button", { name: "Create editable pack file" }).click();
  await expect(
    page.getByText("Image export failed. Please try again."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Got it" }).click();
  expect(await state(page)).toEqual(before);
  await page.evaluate(() => {
    HTMLCanvasElement.prototype.toDataURL = (window as any).originalCanvas;
  });
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Create editable pack file" }).click();
  await event;
  await page.getByRole("button", { name: "Got it" }).click();
});

test("unreadable data fails closed without overwriting stored content", async ({
  page,
}) => {
  await home(page);
  await page.evaluate((k) => localStorage.setItem(k, "{damaged"), key);
  await page.reload();
  await expect(
    page.getByText(
      "Your saved workspace could not be read. It has been kept intact.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start a reaction pack" }),
  ).toHaveCount(0);
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(
    "{damaged",
  );
});

test("mobile screens fit 390px and capture the shipped creator workspace", async ({
  page,
}, info) => {
  await demo(page);
  await page.getByRole("button", { name: "Name & creator credit" }).click();
  await page
    .getByRole("textbox", { name: "Pack name", exact: true })
    .fill("Encore energy");
  await page
    .getByRole("textbox", { name: "Creator credit", exact: true })
    .fill("@luna");
  await page.getByRole("button", { name: "Close collection details" }).click();
  await page
    .getByRole("button", { name: "Save to library", exact: true })
    .click();
  await page.getByRole("button", { name: "Got it" }).click();
  await saved(page);
  const packUrl = page.url();
  async function shot(name: string) {
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.screenshot({ path: info.outputPath(name + ".png") });
  }
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Start a reaction pack" }),
  ).toBeVisible();
  await shot("01-home");
  await page.getByRole("tab", { name: "Library", exact: true }).click();
  await shot("02-library");
  await page.goto(packUrl);
  await expect(page.getByText("Encore energy", { exact: true })).toBeVisible();
  await shot("03-pack");
  await page.getByRole("button", { name: "Refine 1" }).click();
  await shot("04-editor");
  await page.getByRole("button", { name: "Done refining" }).click();
  await page.getByRole("button", { name: "Preview in chat" }).click();
  await shot("05-preview");
});

test("manual erase and restore change exported alpha and recover original pixels", async ({
  page,
}) => {
  await home(page);
  const source =
    "data:image/png;base64," +
    (await fs.readFile(path.join(fixtures, "portrait.png"))).toString("base64");
  const design = {
    ...defaultDesign(source),
    originalSource: source,
    shape: "cutout" as const,
    decoration: "none" as const,
  };
  const erase = {
    mode: "erase" as const,
    radius: 30,
    points: [{ x: 256, y: 220 }],
  };
  const restore = { ...erase, mode: "restore" as const };
  const pixels = await page.evaluate(
    async (xmls) =>
      Promise.all(
        xmls.map(async (xml) => {
          const url = URL.createObjectURL(
            new Blob([xml], { type: "image/svg+xml" }),
          );
          try {
            const image = new Image();
            image.src = url;
            await image.decode();
            const c = document.createElement("canvas");
            c.width = c.height = 512;
            const ctx = c.getContext("2d")!;
            ctx.drawImage(image, 0, 0);
            return Array.from(ctx.getImageData(256, 220, 1, 1).data);
          } finally {
            URL.revokeObjectURL(url);
          }
        }),
      ),
    [
      scene(design),
      scene({ ...design, strokes: [erase] }),
      scene({ ...design, strokes: [erase, restore] }),
      scene({ ...design, strokes: [erase, restore, erase] }),
    ],
  );
  expect(pixels[0][3]).toBe(255);
  expect(pixels[1][3]).toBe(0);
  expect(pixels[2]).toEqual(pixels[0]);
  expect(pixels[3][3]).toBe(0);
});

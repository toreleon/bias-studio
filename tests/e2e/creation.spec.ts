import { test, expect, Page } from "@playwright/test";
import fs from "node:fs/promises";
const key = "bias-studio.workspace.v2";
const testCode = "test-access-code-no-live-provider";
async function saved(page: Page) {
  await expect(
    page.getByRole("button", { name: "Saved on this device", exact: true }),
  ).toBeVisible();
}
async function start(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create with AI", exact: true })
    .click();
  await page.getByRole("button", { name: "Concert cat", exact: true }).click();
  await page
    .getByRole("button", { name: "Choose a look", exact: true })
    .click();
}
async function generate(page: Page, label = "Generate 3 reactions", count = 3) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page
    .getByRole("textbox", { name: "Studio access code" })
    .fill(testCode);
  await page
    .getByRole("button", { name: `Send & generate ${count}`, exact: true })
    .click();
}
async function image() {
  return (
    "data:image/png;base64," +
    (await fs.readFile("tests/fixtures/portrait.png")).toString("base64")
  );
}

test("AI creation keeps partial results, retries missing reactions, reopens and reuses recipe without carrying outputs", async ({
  page,
}) => {
  const result = await image();
  let calls = 0;
  await page.route("http://localhost:8787/v1/stickers", async (route) => {
    calls++;
    expect(route.request().headers().authorization).toBe(`Bearer ${testCode}`);
    expect(route.request().postDataJSON().prompt).toContain("exactly ONE");
    if (calls === 2)
      return route.fulfill({
        status: 503,
        json: { error: "upstream unavailable" },
      });
    return route.fulfill({ json: { image: result, model: "test-fixture" } });
  });
  await start(page);
  await page.getByRole("button", { name: "Look: Soft doodle" }).click();
  await generate(page);
  await expect(
    page.getByText("The generation service is not ready.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Favorite result 1", exact: true }),
  ).toBeVisible();
  await saved(page);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Favorite result 1", exact: true }),
  ).toBeVisible();
  await generate(page, "Generate 2 missing reactions", 2);
  await expect(
    page.getByRole("button", {
      name: "Make pack with 3 favorites",
      exact: true,
    }),
  ).toBeEnabled();
  expect(calls).toBe(4);
  await page.getByRole("button", { name: "Inspect 2", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Result caption" })
    .fill("encore please");
  await expect(
    page.getByRole("textbox", { name: "Result caption" }),
  ).toHaveValue("encore please");
  await page.getByRole("button", { name: "Done inspecting" }).click();
  await page
    .getByRole("button", { name: "Make pack with 3 favorites", exact: true })
    .click();
  await expect(
    page.getByText("3 / 30 REACTIONS · PRIVATE DRAFT"),
  ).toBeVisible();
  await saved(page);
  const state = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    key,
  );
  expect(state.assets).toHaveLength(3);
  expect(state.collections[0].items[1].design.caption).toBe("encore please");
  expect(state.collections[0].items[0].provenance.model).toBe("test-fixture");
  expect(JSON.stringify(state)).not.toContain(testCode);
  await page.goto("/");
  await page.getByRole("button", { name: "Reuse recipe", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Sticker idea" })).toHaveValue(
    "A lavender cat with a star hair clip",
  );
  await saved(page);
  const next = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    key,
  );
  expect(next.creations).toHaveLength(2);
  expect(next.creations[0].look).toBe("soft");
  expect(next.creations[0].candidates).toHaveLength(0);
  expect(next.creations[1].candidates).toHaveLength(3);
});

test("imported results are labeled accurately and creating a pack makes independent copies", async ({
  page,
}) => {
  await start(page);
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Import results from another tool" })
    .click();
  const buffer = await fs.readFile("tests/fixtures/portrait.png");
  await (
    await chooser
  ).setFiles(
    [1, 2, 3].map((i) => ({
      name: `result-${i}.png`,
      mimeType: "image/png",
      buffer,
    })),
  );
  await expect(page.getByText("IMPORTED IMAGE", { exact: true })).toHaveCount(
    3,
  );
  await page
    .getByRole("button", { name: "Favorite result 2", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Make pack with 2 favorites", exact: true })
    .click();
  await saved(page);
  await page.reload();
  await expect(
    page.getByText("2 / 30 REACTIONS · PRIVATE DRAFT"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Refine 1", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Sticker caption" })
    .fill("changed in pack");
  await saved(page);
  const data = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    key,
  );
  expect(data.creations[0].candidates[0].caption).toBe("my whole heart");
  expect(data.assets[0].design.caption).toBe("my whole heart");
  expect(data.collections[0].items[0].design.caption).toBe("changed in pack");
});

test("cancel stops the queue, preserves brief and never auto-retries or persists access code", async ({
  page,
}) => {
  let calls = 0;
  await page.route("http://localhost:8787/v1/stickers", async (route) => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.fulfill({ status: 503, json: {} }).catch(() => {});
  });
  await start(page);
  await generate(page);
  await expect(
    page.getByRole("button", { name: "Stop generation", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Stop generation", exact: true })
    .click();
  await expect(
    page.getByText("Generation stopped.", { exact: false }),
  ).toBeVisible();
  await saved(page);
  expect(calls).toBe(1);
  const data = await page.evaluate((k) => localStorage.getItem(k)!, key);
  expect(data).not.toContain(testCode);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Sticker idea" })).toHaveValue(
    "A lavender cat with a star hair clip",
  );
});

test("creation screens fit compact mobile viewports with accessible controls", async ({
  page,
}) => {
  await start(page);
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    for (const step of [
      "Step 1: Your idea",
      "Step 2: The vibe",
      "Step 3: Favorites",
    ]) {
      await page.getByRole("button", { name: step, exact: true }).click();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
  }
});

import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

test("a stalled photo import can be cancelled; late decoding cannot change the pack and retry succeeds", async ({ page }) => {
  await page.route("http://localhost:8787/v1/config", route => route.fulfill({json:{publicPages:false,telegram:false}}));
  await page.goto("/");
  await page.getByRole("button", {name:"Try a 3-reaction demo",exact:true}).click();
  await expect(page.getByRole("button", {name:"Saved on this device",exact:true})).toBeVisible();
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem("bias-studio.workspace.v2")!));
  // Hold image decoding after the file chooser returns, reproducing a native
  // processing promise that never resolves until after the creator cancels.
  await page.evaluate(() => {
    const target = window as any;
    const ImageConstructor = window.Image;
    const pending: (() => void)[] = [];
    target.__importImageFinished = false;
    target.Image = function () {
      const image = new ImageConstructor();
      image.addEventListener("load", () => { target.__importImageFinished = true; });
      Object.defineProperty(image, "src", {
        configurable:true,
        set(value:string) { pending.push(() => { delete (image as any).src; image.src = value; }); },
      });
      return image;
    };
    target.__releaseImportedImages = () => { target.Image = ImageConstructor; pending.splice(0).forEach(release => release()); };
  });
  const file = {name:"moment.png",mimeType:"image/png",buffer:await fs.readFile("tests/fixtures/portrait.png")};
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", {name:"Add photos",exact:true}).click();
  await (await chooser).setFiles(file);
  const progress = page.getByTestId("workspace-progress-overlay");
  await expect(progress).toBeVisible();
  await expect(page.getByText("Preparing photo 1 of 1…",{exact:true})).toBeVisible();
  // Progress uses an in-tree view, allowing the native picker to own its modal.
  await expect(progress.locator("xpath=ancestor-or-self::*[@role='dialog']")).toHaveCount(0);
  await page.getByRole("button", {name:"Cancel import",exact:true}).click();
  await expect(progress).toHaveCount(0);
  await page.evaluate(() => (window as any).__releaseImportedImages());
  await expect.poll(() => page.evaluate(() => (window as any).__importImageFinished)).toBe(true);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("bias-studio.workspace.v2")!))).toEqual(original);
  const retry = page.waitForEvent("filechooser");
  await page.getByRole("button", {name:"Add photos",exact:true}).click();
  await (await retry).setFiles(file);
  await expect(page.getByText("4 / 30 REACTIONS · PRIVATE DRAFT",{exact:true})).toBeVisible();
  await expect(page.getByRole("button", {name:"Saved on this device",exact:true})).toBeVisible();
  const updated = await page.evaluate(() => JSON.parse(localStorage.getItem("bias-studio.workspace.v2")!));
  expect(updated.collections[0].items.slice(0,3)).toEqual(original.collections[0].items);
});

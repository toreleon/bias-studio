import { test, expect, Page, Route } from "@playwright/test";
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
async function generate(page: Page, label = "Generate one sample", count = 1, code = testCode) {
  await page.getByRole("button", { name: label, exact: true }).click();
  const input = page.getByRole("textbox", { name: "Studio access code" });
  if (await input.count()) await input.fill(code);
  await page.getByRole("button", { name: `Send & generate ${count}`, exact: true }).click();
}
async function approveSample(page: Page) {
  await page.getByRole("button", { name: "Inspect 1", exact: true }).click();
  await page.getByRole("button", { name: "Approve as sample", exact: true }).click();
  await expect(page.getByText("Sample approved", { exact: true })).toBeVisible();
}
async function recover(page: Page, code = testCode) {
  await page.getByRole("button", { name: "Step 3: Favorites", exact: true }).click();
  await page.getByRole("button", { name: "Recover saved requests", exact: true }).click();
  const input = page.getByRole("textbox", { name: "Studio access code" });
  if (await input.count()) await input.fill(code);
  await page.getByRole("button", { name: "Connect & recover", exact: true }).click();
}
type Submitted = { requestId: string; prompt: string; reference?: string };
type FixtureJob = { id: string; requestId: string; status: string; result?: { image: string; model: string }; error?: { code: string; message: string } };
async function betaFixture(page: Page, onSubmit?: (route: Route, body: Submitted, job: FixtureJob, attempt: number) => Promise<boolean>, sessionOwners = ["creator-fixture"]) {
  const result = await image();
  const posts: Submitted[] = [];
  const jobs = new Map<string, FixtureJob>();
  const kept = new Set<string>();
  let polls = 0;
  let sessions = 0;
  await page.route("http://localhost:8787/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/v1/config") return route.fulfill({ json: { publicPages: false, telegram: false } });
    if (path === "/v1/session") {
      expect(request.method()).toBe("POST");
      expect(request.headers().authorization).toBeUndefined();
      const ownerId = sessionOwners[Math.min(sessions++, sessionOwners.length - 1)];
      expect(request.postDataJSON()).toEqual({ code: sessionOwners.length > 1 ? `${testCode}-${ownerId}` : testCode });
      return route.fulfill({ json: { token: "bs_sess_browser_fixture", expiresAt: Date.now() + 3600000, creator: { id: ownerId, label: "Fixture creator", quota: 20 } } });
    }
    expect(request.headers().authorization).toBe("Bearer bs_sess_browser_fixture");
    if (path === "/v1/usage") return route.fulfill({ json: { quota: 20, remainingToday: 20 - jobs.size, attemptsToday: jobs.size, kept: kept.size } });
    if (path === "/v1/jobs" && request.method() === "POST") {
      const body: Submitted = request.postDataJSON();
      expect(Object.keys(body).sort()).toEqual(body.reference ? ["prompt", "reference", "requestId"] : ["prompt", "requestId"]);
      expect(body.requestId).toMatch(/^[a-zA-Z0-9-]+$/);
      expect(body.prompt).toContain("exactly ONE");
      posts.push(body);
      let job = jobs.get(body.requestId);
      if (!job) {
        job = { id: `job-${jobs.size + 1}`, requestId: body.requestId, status: "succeeded", result: { image: result, model: "test-fixture" } };
        jobs.set(body.requestId, job);
      }
      if (await onSubmit?.(route, body, job, posts.length)) return;
      return route.fulfill({ json: job });
    }
    const keep = /^\/v1\/jobs\/(job-\d+)\/kept$/.exec(path);
    if (keep) {
      expect(request.method()).toBe("POST");
      expect(request.postDataJSON()).toEqual({ kept: true });
      expect([...jobs.values()].some((job) => job.id === keep[1] && job.status === "succeeded")).toBe(true);
      kept.add(keep[1]);
      return route.fulfill({ status: 204 });
    }
    const read = /^\/v1\/jobs\/(job-\d+)$/.exec(path);
    if (read) {
      polls++;
      expect(request.method()).toBe("GET");
      const job = [...jobs.values()].find((j) => j.id === read[1]);
      expect(job).toBeDefined();
      return route.fulfill({ json: job });
    }
    throw new Error(`Unexpected beta request: ${request.method()} ${path}`);
  });
  return { posts, jobs, kept, get polls() { return polls; }, get sessions() { return sessions; } };
}
async function image() {
  return (
    "data:image/png;base64," +
    (await fs.readFile("tests/fixtures/portrait.png")).toString("base64")
  );
}

test("sample approval gates the lineup; partial failure, reopening and recipe reuse retain exact output IDs", async ({ page }) => {
  const fixture = await betaFixture(page, async (route, _body, job, attempt) => {
    if (attempt !== 2) return false;
    job.status = "failed";
    delete job.result;
    job.error = { code: "provider_failed", message: "Fixture provider unavailable." };
    await route.fulfill({ json: job });
    return true;
  });
  await start(page);
  await page.getByRole("button", { name: "Look: Soft doodle" }).click();
  expect(fixture.posts).toHaveLength(0);
  await generate(page);
  await expect(page.getByRole("button", { name: "Favorite result 1", exact: true })).toBeVisible();
  expect(fixture.posts).toHaveLength(1);
  await expect(page.getByRole("button", { name: "Generate 2 remaining reactions", exact: true })).toHaveCount(0);
  await approveSample(page);
  await generate(page, "Generate 2 remaining reactions", 2);
  await expect(page.getByText("Fixture provider unavailable.", { exact: false })).toBeVisible();
  await saved(page);
  expect(fixture.posts).toHaveLength(2);
  await page.reload();
  await expect(page.getByRole("button", { name: "Favorite result 1", exact: true })).toBeVisible();
  await expect(page.getByText("Sample approved", { exact: true })).toBeVisible();
  await generate(page, "Generate 2 remaining reactions", 2);
  await expect(page.getByRole("button", { name: "Make pack with 3 favorites", exact: true })).toBeEnabled();
  expect(fixture.posts).toHaveLength(4);
  expect(new Set(fixture.posts.map((p) => p.requestId)).size).toBe(4);
  await page.getByRole("button", { name: "Inspect 2", exact: true }).click();
  await page.getByRole("textbox", { name: "Result caption" }).fill("encore please");
  await page.getByRole("button", { name: "Done inspecting", exact: true }).click();
  await page.getByRole("button", { name: "Make pack with 3 favorites", exact: true }).click();
  await expect(page.getByText("3 / 30 REACTIONS · PRIVATE DRAFT")).toBeVisible();
  await saved(page);
  const state = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key);
  expect(state.assets).toHaveLength(3);
  expect(state.collections[0].items[1].design.caption).toBe("encore please");
  expect(state.collections[0].items[0].provenance.model).toBe("test-fixture");
  expect(JSON.stringify(state)).not.toContain(testCode);
  expect(JSON.stringify(state)).not.toContain("bs_sess_browser_fixture");
  expect([...fixture.kept].sort()).toEqual(["job-1", "job-3", "job-4"]);
  expect(state.creations[0].attempts.filter((a: any) => a.kept).map((a: any) => a.jobId).sort()).toEqual([...fixture.kept].sort());
  expect(state.creations[0].attempts.every((a: any) => a.ownerId === "creator-fixture")).toBe(true);
  await page.goto("/");
  await page.getByRole("button", { name: "Reuse recipe", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Sticker idea" })).toHaveValue("A lavender cat with a star hair clip");
  await saved(page);
  const next = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key);
  expect(next.creations).toHaveLength(2);
  expect(next.creations[0].look).toBe("soft");
  expect(next.creations[0].candidates).toHaveLength(0);
  expect(next.creations[0].attempts || []).toHaveLength(0);
  expect(next.creations[0].approvedSampleId).toBeUndefined();
  expect(next.creations[1].candidates).toHaveLength(3);
  expect(fixture.posts).toHaveLength(4);
  await page.getByRole("button", { name: "Choose a look", exact: true }).click();
  await generate(page);
  await expect(page.getByRole("button", { name: "Favorite result 1", exact: true })).toBeVisible();
  await approveSample(page);
  await generate(page, "Generate 2 remaining reactions", 2);
  await expect(page.getByRole("button", { name: "Make pack with 3 favorites", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Make pack with 3 favorites", exact: true }).click();
  await expect(page.getByText("3 / 30 REACTIONS · PRIVATE DRAFT")).toBeVisible();
  await saved(page);
  const second = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key);
  expect(second.collections).toHaveLength(2);
  expect(second.collections[0].items[0].id).not.toBe(second.collections[1].items[0].id);
  expect(second.collections[0].items[0].provenance.look).toBe("soft");
  expect(fixture.posts).toHaveLength(7);
});

test("a selective variation adds one attempt and retains existing candidate identities", async ({ page }) => {
  const fixture = await betaFixture(page);
  await start(page);
  await generate(page);
  await expect(page.getByRole("button", { name: "Favorite result 1", exact: true })).toBeVisible();
  await approveSample(page);
  await generate(page, "Generate 2 remaining reactions", 2);
  await expect(page.getByRole("button", { name: "Favorite result 3", exact: true })).toBeVisible();
  await saved(page);
  const original = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).creations[0], key);
  await page.getByRole("button", { name: "Inspect 2", exact: true }).click();
  await page.getByRole("button", { name: "Try another of this reaction", exact: true }).click();
  await page.getByRole("button", { name: "Send & generate 1", exact: true }).click();
  await expect(page.getByRole("button", { name: "Favorite result 4", exact: true })).toBeVisible();
  await saved(page);
  const updated = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).creations[0], key);
  expect(fixture.posts).toHaveLength(4);
  expect(updated.candidates.slice(0, 3)).toEqual(original.candidates);
  expect(updated.candidates[3].feeling).toBe(original.candidates[1].feeling);
  expect(updated.candidates[3].attemptId).not.toBe(original.candidates[1].attemptId);
  expect(updated.approvedSampleId).toBe(original.approvedSampleId);
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

test("a lost submission reply reopens and recovers the exact paid job without creating a second job", async ({ page }) => {
  const fixture = await betaFixture(page, async (route, _body, _job, attempt) => {
    if (attempt !== 1) return false;
    await route.abort("failed");
    return true;
  });
  await start(page);
  await generate(page);
  await expect(page.getByText("Connection interrupted.", { exact: false })).toBeVisible();
  await saved(page);
  const initial = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key);
  expect(initial.creations[0].attempts).toHaveLength(1);
  expect(initial.creations[0].attempts[0].requestId).toBe(fixture.posts[0].requestId);
  expect(initial.creations[0].candidates).toHaveLength(0);
  await page.reload();
  await recover(page);
  await expect(page.getByRole("button", { name: "Favorite result 1", exact: true })).toBeVisible();
  await saved(page);
  expect(fixture.posts).toHaveLength(2);
  expect(fixture.posts[1]).toEqual(fixture.posts[0]);
  expect(fixture.jobs.size).toBe(1);
  const restored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key);
  expect(restored.creations[0].attempts).toHaveLength(1);
  expect(restored.creations[0].candidates).toHaveLength(1);
  expect(restored.creations[0].candidates[0].attemptId).toBe(fixture.posts[0].requestId);
  expect(JSON.stringify(restored)).not.toContain(testCode);
  expect(JSON.stringify(restored)).not.toContain("bs_sess_browser_fixture");
});

test("pausing monitoring preserves the running job for recovery and never automatically retries", async ({ page }) => {
  const fixture = await betaFixture(page, async (_route, _body, job, attempt) => {
    if (attempt === 1) { job.status = "running"; delete job.result; }
    return false;
  });
  await start(page);
  await generate(page);
  await expect(page.getByRole("button", { name: "Pause monitoring", exact: true })).toBeVisible();
  await expect.poll(() => fixture.posts.length).toBe(1);
  await expect.poll(async () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).creations[0].attempts[0].jobId, key)).toBe("job-1");
  await page.getByRole("button", { name: "Pause monitoring", exact: true }).click();
  await expect(page.getByText("Monitoring paused.", { exact: false })).toBeVisible();
  await saved(page);
  const job = [...fixture.jobs.values()][0];
  job.status = "succeeded";
  job.result = { image: await image(), model: "test-fixture" };
  await page.reload();
  expect(fixture.posts).toHaveLength(1);
  await recover(page);
  await expect(page.getByRole("button", { name: "Favorite result 1", exact: true })).toBeVisible();
  expect(fixture.posts).toHaveLength(1);
  expect(fixture.polls).toBeGreaterThanOrEqual(1);
  expect(fixture.jobs.size).toBe(1);
});

test("recovering under a different creator cannot submit or charge the saved request", async ({ page }) => {
  const fixture = await betaFixture(page, async (route, _body, _job, attempt) => {
    if (attempt !== 1) return false;
    await route.abort("failed");
    return true;
  }, ["creator-original", "creator-other", "creator-original"]);
  await start(page);
  await generate(page, "Generate one sample", 1, `${testCode}-creator-original`);
  await expect(page.getByText("Connection interrupted.", { exact: false })).toBeVisible();
  await saved(page);
  const first = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).creations[0], key);
  expect(first.attempts[0].ownerId).toBe("creator-original");
  await page.reload();
  await recover(page, `${testCode}-creator-other`);
  await expect(page.getByRole("alert")).toContainText("Reconnect the creator account that started this request. No generation request was sent.");
  expect(fixture.sessions).toBe(2);
  expect(fixture.posts).toHaveLength(1);
  expect(fixture.jobs.size).toBe(1);
  expect(fixture.polls).toBe(0);
  const blocked = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).creations[0], key);
  expect(blocked.attempts).toEqual(first.attempts);
  expect(blocked.candidates).toHaveLength(0);
  await page.getByRole("button", { name: "Recover saved requests", exact: true }).click();
  await page.getByRole("button", { name: "Use a different creator invite", exact: true }).click();
  await page.getByRole("textbox", { name: "Studio access code", exact: true }).fill(`${testCode}-creator-original`);
  await page.getByRole("button", { name: "Connect & recover", exact: true }).click();
  await expect(page.getByRole("button", { name: "Favorite result 1", exact: true })).toBeVisible();
  expect(fixture.sessions).toBe(3);
  expect(fixture.posts).toHaveLength(2);
  expect(fixture.posts[1]).toEqual(fixture.posts[0]);
  expect(fixture.jobs.size).toBe(1);
});

test("quota rejection keeps request identity and drafts recoverable without an automatic retry", async ({ page }) => {
  const fixture = await betaFixture(page, async (route) => {
    await route.fulfill({ status: 429, json: { error: "allowance reached" } });
    return true;
  });
  await start(page);
  await generate(page);
  await expect(page.getByText("Your beta allowance or service limit is reached.", { exact: false })).toBeVisible();
  await saved(page);
  const data = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key);
  expect(data.creations[0].attempts).toHaveLength(1);
  expect(data.creations[0].attempts[0].requestId).toBe(fixture.posts[0].requestId);
  expect(data.creations[0].candidates).toHaveLength(0);
  expect(fixture.posts).toHaveLength(1);
  await page.reload();
  await page.getByRole("button", { name: "Step 3: Favorites", exact: true }).click();
  await expect(page.getByRole("button", { name: "Recover saved requests", exact: true })).toBeVisible();
  expect(fixture.posts).toHaveLength(1);
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

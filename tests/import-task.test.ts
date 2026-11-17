import test from "node:test";
import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import { assertImportActive, waitForImport } from "../src/import-task";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test("cancelling an unsettled import stops waiting and ignores its late native result", async () => {
  const controller = new AbortController();
  const native = deferred<string>();
  const committed: string[] = [];
  const importing = waitForImport(native.promise, { signal: controller.signal })
    .then((value) => { committed.push(value); return value; });
  assert.equal(getEventListeners(controller.signal, "abort").length, 1);
  controller.abort();
  await assert.rejects(importing, { name: "AbortError" });
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
  native.resolve("late-photo.png");
  await native.promise;
  await Promise.resolve();
  assert.deepEqual(committed, []);
});

test("already-cancelled imports consume late native failures without starting a commit", async () => {
  const controller = new AbortController();
  controller.abort();
  const native = deferred<string>();
  const importing = waitForImport(native.promise, { signal: controller.signal });
  await assert.rejects(importing, { name: "AbortError" });
  native.reject(new Error("native request finished after cancellation"));
  await Promise.resolve();
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
  assert.throws(() => assertImportActive({ signal: controller.signal }), { name: "AbortError" });
});

test("a picker has no implicit processing deadline while the user is choosing", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const selection = deferred<string[]>();
  const importing = waitForImport(selection.promise, {});
  t.mock.timers.tick(60 * 60 * 1000);
  selection.resolve(["selected-heic-photo"]);
  assert.deepEqual(await importing, ["selected-heic-photo"]);
});

test("processing deadlines release listeners and allow a fresh retry while old work finishes", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const controller = new AbortController();
  const native = deferred<string>();
  const committed: string[] = [];
  const importing = waitForImport(native.promise, { signal: controller.signal }, 45000, "Photo 2 took too long.")
    .then((value) => { committed.push(value); return value; });
  const failed = assert.rejects(importing, { name: "ImportTimeoutError", message: "Photo 2 took too long." });
  t.mock.timers.tick(45000);
  await failed;
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
  const retried = await waitForImport(Promise.resolve("new-photo.png"), { signal: controller.signal }, 45000);
  committed.push(retried);
  native.resolve("old-photo.png");
  await native.promise;
  await Promise.resolve();
  t.mock.timers.tick(45000);
  assert.deepEqual(committed, ["new-photo.png"]);
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
});

test("storage failures preserve the useful error and clean up cancellation listeners", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const controller = new AbortController();
  const storageError = new Error("Device storage is full.");
  await assert.rejects(
    waitForImport(Promise.reject(storageError), { signal: controller.signal }, 45000),
    (error: unknown) => error === storageError,
  );
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
  t.mock.timers.tick(45000);
  assert.equal(await waitForImport(Promise.resolve("saved-after-freeing-space.png"), { signal: controller.signal }, 45000), "saved-after-freeing-space.png");
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
});

test("cancellation wins when a resolved native result has not reached the caller yet", async () => {
  const controller = new AbortController();
  const native = deferred<string>();
  const importing = waitForImport(native.promise, { signal: controller.signal });
  native.resolve("too-late.png");
  controller.abort();
  await assert.rejects(importing, { name: "AbortError" });
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
});

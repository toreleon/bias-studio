import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newCreation,
  reuseRecipe,
  generationPrompt,
  validCreation,
} from "../src/creation/model";
import { emptyWorkspace, migrate, validWorkspace } from "../src/workspace";
import { generateImage } from "../src/creation/client";
const uri = "data:image/png;base64,iVBORw0KGgo=";
test("old v2 workspaces remain valid; creation recipes and candidates survive reopening", () => {
  const old = emptyWorkspace();
  assert.deepEqual(migrate(old), old);
  const draft = newCreation({
    prompt: "lavender cat",
    look: "pop",
    feelings: ["love"],
    captions: true,
    reference: uri,
  });
  draft.candidates.push({
    id: "result-1",
    uri,
    feeling: "love",
    caption: "heart",
    selected: true,
    provenance: {
      kind: "generated",
      prompt: draft.prompt,
      look: "pop",
      feeling: "love",
      model: "test",
    },
  });
  const workspace = { ...old, creations: [draft] };
  assert.ok(validWorkspace(workspace));
  assert.deepEqual(migrate(JSON.parse(JSON.stringify(workspace))), workspace);
  const next = reuseRecipe(draft);
  assert.notEqual(next.id, draft.id);
  assert.equal(next.reference, uri);
  assert.deepEqual(next.candidates, []);
  next.feelings.push("hype");
  assert.deepEqual(draft.feelings, ["love"]);
});
test("invalid or unsafe creation inputs do not enter the saved workspace", () => {
  const draft = newCreation();
  for (const bad of [
    { ...draft, reference: "https://tracker.test/image.png" },
    { ...draft, look: "unknown" },
    { ...draft, feelings: ["love", "love"] },
    { ...draft, prompt: "x".repeat(1201) },
    { ...draft, candidates: [{ uri }] },
  ])
    assert.equal(validCreation(bad), false);
});
test("generation instructions keep captions editable and use an explicit reaction and reference", () => {
  const draft = newCreation({
    prompt: "Moon cat",
    look: "paper",
    feelings: ["love"],
    captions: true,
    reference: uri,
  });
  const prompt = generationPrompt(draft, "love");
  assert.match(prompt, /exactly ONE/);
  assert.match(prompt, /No text/);
  assert.match(prompt, /Moon cat/);
  assert.match(prompt, /paper-cut/);
  assert.match(prompt, /holding a heart/);
  assert.match(prompt, /attached reference/);
});
test("client requires secure service, does not leak provider errors, and rejects remote result links", async () => {
  const signal = new AbortController().signal;
  await assert.rejects(
    generateImage("http://untrusted.test", "code", { prompt: "cat" }, signal),
    /secure/,
  );
  const failure = async () =>
    new Response(JSON.stringify({ error: "secret upstream error" }), {
      status: 429,
    });
  await assert.rejects(
    generateImage(
      "https://studio.test",
      "code",
      { prompt: "cat" },
      signal,
      failure as typeof fetch,
    ),
    /at its limit/,
  );
  const remote = async () =>
    new Response(
      JSON.stringify({ image: "https://tracker.test/a.png", model: "test" }),
    );
  await assert.rejects(
    generateImage(
      "https://studio.test",
      "code",
      { prompt: "cat" },
      signal,
      remote as typeof fetch,
    ),
    /unreadable/,
  );
});

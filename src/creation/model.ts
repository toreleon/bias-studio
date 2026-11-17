import { newId } from "../domain";

export const looks = [
  {
    id: "pop",
    name: "Pop comic",
    detail: "Bold lines · big energy",
    color: "#F4C2D6",
    prompt:
      "expressive pop comic illustration, bold clean ink outlines, lilac and pink accents",
  },
  {
    id: "soft",
    name: "Soft doodle",
    detail: "Little lines · warm feelings",
    color: "#E5EED0",
    prompt: "warm hand-drawn doodle, soft pastel colors, simple rounded forms",
  },
  {
    id: "chibi",
    name: "Mini character",
    detail: "Tiny proportions · extra cute",
    color: "#E0D6FA",
    prompt:
      "cute chibi character illustration, small body and expressive face, crisp edges",
  },
  {
    id: "paper",
    name: "Paper cut",
    detail: "Layered shapes · playful texture",
    color: "#F7DDAB",
    prompt:
      "layered paper-cut illustration, tactile paper texture, simple strong silhouette",
  },
] as const;
export type Look = (typeof looks)[number]["id"];
export const feelings = [
  {
    id: "love",
    emoji: "♡",
    label: "Love",
    caption: "my whole heart",
    prompt: "adoring expression, holding a heart",
  },
  {
    id: "hype",
    emoji: "✦",
    label: "Hype",
    caption: "WE WON",
    prompt: "excited celebration, hands raised",
  },
  {
    id: "cry",
    emoji: "☂",
    label: "Happy tears",
    caption: "I am not okay",
    prompt: "overwhelmed with happy tears",
  },
  {
    id: "shock",
    emoji: "!",
    label: "Shocked",
    caption: "wait WHAT",
    prompt: "surprised wide-eyed expression",
  },
  {
    id: "proud",
    emoji: "★",
    label: "Proud",
    caption: "you did that!",
    prompt: "proud smile, enthusiastic thumbs up",
  },
  {
    id: "tired",
    emoji: "☾",
    label: "Tired",
    caption: "no thoughts",
    prompt: "sleepy exhausted expression",
  },
] as const;
export type Feeling = (typeof feelings)[number]["id"];
export type Recipe = {
  prompt: string;
  look: Look;
  feelings: Feeling[];
  reference?: string;
  captions: boolean;
};
export type Provenance = {
  kind: "generated" | "imported";
  prompt: string;
  look: Look;
  feeling: Feeling;
  model?: string;
};
export type Candidate = {
  id: string;
  uri: string;
  caption: string;
  feeling: Feeling;
  selected: boolean;
  provenance: Provenance;
  attemptId?: string;
};
export const jobStatuses = ["queued", "running", "succeeded", "failed", "cancelled", "interrupted"] as const;
export type JobStatus = (typeof jobStatuses)[number];
export type GenerationAttempt = {
  requestId: string;
  ownerId?: string;
  jobId?: string;
  feeling: Feeling;
  /** Immutable request snapshot: replay it verbatim after a lost response. */
  prompt: string;
  reference?: string;
  subject: string;
  look: Look;
  caption: string;
  status: JobStatus;
  error?: string;
  kept?: boolean;
  keptReported?: boolean;
  resultExpired?: boolean;
};
export type Creation = Recipe & {
  id: string;
  updatedAt: number;
  candidates: Candidate[];
  saved?: boolean;
  attempts?: GenerationAttempt[];
  approvedSampleId?: string;
  useSampleReference?: boolean;
};
export function recoverableAttempts(creation: Creation) {
  return (creation.attempts || []).filter((attempt) =>
    ["queued", "running", "succeeded"].includes(attempt.status) && !attempt.resultExpired &&
    !creation.candidates.some((candidate) => candidate.attemptId === attempt.requestId),
  );
}
export function generationTargets(creation: Creation, requested: Feeling[]): Feeling[] {
  const approved = creation.candidates.some((c) => c.id === creation.approvedSampleId);
  return requested.slice(0, approved ? 24 - creation.candidates.length : Math.min(1, 24 - creation.candidates.length));
}
export const newCreation = (recipe?: Recipe): Creation => ({
  prompt: "",
  look: "pop",
  feelings: ["love", "hype", "cry"],
  captions: true,
  ...recipe,
  id: newId(),
  updatedAt: Date.now(),
  candidates: [],
});
export function reuseRecipe(creation: Creation): Creation {
  return newCreation({
    prompt: creation.prompt,
    look: creation.look,
    feelings: [...creation.feelings],
    captions: creation.captions,
    reference: creation.reference,
  });
}
export function generationPrompt(recipe: Recipe, feeling: Feeling) {
  return [
    "Create exactly ONE isolated reaction sticker, not a sheet or grid. Center the complete subject with generous transparent padding. No text, lettering, watermark or background scene.",
    `Subject: ${recipe.prompt.trim()}.`,
    `Visual style: ${looks.find((l) => l.id === recipe.look)!.prompt}.`,
    `Reaction: ${feelings.find((f) => f.id === feeling)!.prompt}.`,
    recipe.reference
      ? "Use the attached reference for the character's recognizable appearance and outfit. This is a stylized reinterpretation, not an exact photo cutout."
      : "Keep the subject's appearance consistent with this description.",
  ].join("\n");
}
const record = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length <= max;
const image = (v: unknown): v is string =>
  typeof v === "string" &&
  /^(file:\/\/|data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$)/.test(v);
const identifier = (v: unknown): v is string =>
  typeof v === "string" && /^[a-zA-Z0-9_-]{1,120}$/.test(v);
export const isFeeling = (v: unknown): v is Feeling =>
  feelings.some((f) => f.id === v);
export const isLook = (v: unknown): v is Look => looks.some((l) => l.id === v);
export function validProvenance(v: unknown): v is Provenance {
  return (
    record(v) &&
    ["generated", "imported"].includes(v.kind) &&
    text(v.prompt, 1200) &&
    isLook(v.look) &&
    isFeeling(v.feeling) &&
    (v.model === undefined || text(v.model, 120))
  );
}
export function validCreation(v: unknown): v is Creation {
  return (
    record(v) &&
    identifier(v.id) &&
    text(v.prompt, 1200) &&
    isLook(v.look) &&
    Array.isArray(v.feelings) &&
    v.feelings.length <= 6 &&
    v.feelings.every(isFeeling) &&
    new Set(v.feelings).size === v.feelings.length &&
    typeof v.captions === "boolean" &&
    (v.reference === undefined || image(v.reference)) &&
    Number.isFinite(v.updatedAt) &&
    v.updatedAt >= 0 &&
    (v.saved === undefined || typeof v.saved === "boolean") &&
    (v.approvedSampleId === undefined || identifier(v.approvedSampleId)) &&
    (v.useSampleReference === undefined || typeof v.useSampleReference === "boolean") &&
    (v.attempts === undefined || (Array.isArray(v.attempts) && v.attempts.length <= 120 &&
      new Set(v.attempts.map((a: any) => a?.requestId)).size === v.attempts.length &&
      v.attempts.every((a: any) => record(a) && identifier(a.requestId) && a.requestId.length >= 8 &&
        (a.ownerId === undefined || identifier(a.ownerId)) &&
        (a.jobId === undefined || identifier(a.jobId)) && isFeeling(a.feeling) &&
        text(a.prompt, 4000) && a.prompt.length > 0 && text(a.subject, 1200) && isLook(a.look) && text(a.caption, 28) &&
        (a.reference === undefined || (image(a.reference) && a.reference.startsWith("data:") && a.reference.length <= 8 * 1024 * 1024)) &&
        jobStatuses.includes(a.status) && (a.error === undefined || text(a.error, 1000)) &&
        (a.kept === undefined || typeof a.kept === "boolean") &&
        (a.keptReported === undefined || typeof a.keptReported === "boolean") &&
        (a.resultExpired === undefined || typeof a.resultExpired === "boolean")))) &&
    Array.isArray(v.candidates) &&
    v.candidates.length <= 24 &&
    new Set(v.candidates.map((c: any) => c?.id)).size === v.candidates.length &&
    v.candidates.every(
      (c: any) =>
        record(c) &&
        identifier(c.id) &&
        image(c.uri) &&
        text(c.caption, 28) &&
        isFeeling(c.feeling) &&
        typeof c.selected === "boolean" &&
        (c.attemptId === undefined || identifier(c.attemptId)) &&
        validProvenance(c.provenance),
    )
  );
}

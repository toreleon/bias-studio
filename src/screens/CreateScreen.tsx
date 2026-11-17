import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowRight,
  ImagePlus,
  RefreshCw,
  Sparkles,
} from "lucide-react-native";
import { Action, Chip, K, Shell, v } from "../CreatorUI";
import { Art, T } from "../ui";
import { useWorkspace } from "../WorkspaceProvider";
import { defaultDesign, newId } from "../domain";
import { newCollection, reaction } from "../workspace";
import { imageData, pickMany, prepareGeneratedImage } from "../media";
import {
  Candidate,
  Creation,
  Feeling,
  feelings,
  generationPrompt,
  looks,
  reuseRecipe,
} from "../creation/model";
import { generateImage, generationURL } from "../creation/client";

export function CreateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useWorkspace();
  const width = useWindowDimensions().width;
  const draft = store.data.creations?.find((c) => c.id === id);
  const [step, setStep] = useState(draft?.candidates.length ? 2 : 0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [connect, setConnect] = useState<Feeling[] | null>(null);
  const [token, setToken] = useState("");
  const [connectReady, setConnectReady] = useState(false);
  const [inspectReady, setInspectReady] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [inspect, setInspect] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
      active.current?.abort();
    },
    [],
  );
  const latest = useRef(draft);
  latest.current = draft;
  function update(fn: (d: Creation) => Creation) {
    store.change((old) => ({
      ...old,
      creations: (old.creations || []).map((d) =>
        d.id === id ? { ...fn(d), updatedAt: Date.now() } : d,
      ),
    }));
  }
  if (!draft)
    return (
      <Shell>
        <T style={v.title}>Creation not found</T>
        <Action label="Back home" onPress={() => router.replace("/")} />
      </Shell>
    );
  const chosen = draft.candidates.filter((c) => c.selected);
  const missing = draft.feelings.filter(
    (f) => !draft.candidates.some((c) => c.feeling === f),
  );
  const look = looks.find((l) => l.id === draft.look)!;
  const valid = !!draft.prompt.trim() && draft.feelings.length > 0;
  const full = draft.candidates.length >= 24;
  function requestGeneration(targets: Feeling[]) {
    if (busy || !valid || !generationURL || !targets.length || full) return;
    setConnectReady(false);
    setConnect(targets.slice(0, 24 - draft!.candidates.length));
  }
  async function generate(targets: Feeling[]) {
    if (active.current) return;
    const snapshot = latest.current!;
    const controller = new AbortController();
    active.current = controller;
    setConnect(null);
    setError("");
    setStep(2);
    let savedCount = 0;
    try {
      await store.flush();
      const reference = snapshot.reference
        ? await imageData(snapshot.reference)
        : undefined;
      for (const feeling of targets) {
        if (controller.signal.aborted) break;
        setBusy(
          `Making ${feelings.find((f) => f.id === feeling)!.label.toLowerCase()} · ${savedCount + 1} of ${targets.length}`,
        );
        // No automatic retries: each request may incur a provider charge.
        const timeout = setTimeout(() => controller.abort(), 165000);
        let result;
        try {
          result = await generateImage(
            generationURL,
            token,
            { prompt: generationPrompt(snapshot, feeling), reference },
            controller.signal,
          );
        } finally {
          clearTimeout(timeout);
        }
        const uri = await prepareGeneratedImage(result.image);
        if (!mounted.current || controller.signal.aborted) break;
        const candidate: Candidate = {
          id: newId(),
          uri,
          feeling,
          selected: true,
          caption: snapshot.captions
            ? feelings.find((f) => f.id === feeling)!.caption
            : "",
          provenance: {
            kind: "generated",
            prompt: snapshot.prompt,
            look: snapshot.look,
            feeling,
            model: result.model,
          },
        };
        update((d) => ({ ...d, candidates: [...d.candidates, candidate] }));
        await store.flush();
        savedCount++;
      }
    } catch (e) {
      if (mounted.current)
        setError(
          controller.signal.aborted
            ? "Generation stopped. Finished results are kept. An in-flight request may still be charged; nothing retries automatically."
            : e instanceof Error && !(e instanceof TypeError)
              ? e.message
              : "Connection interrupted. Your finished results are safe; try again.",
        );
    } finally {
      active.current = null;
      if (mounted.current) setBusy("");
    }
  }
  async function importResults() {
    await store.run("Opening your images…", async () => {
      const snapshot = latest.current!;
      const images = await pickMany("photo", 24 - snapshot.candidates.length);
      if (!images.length) return;
      const candidates: Candidate[] = [];
      for (let i = 0; i < images.length; i++) {
        const feeling =
          snapshot.feelings[i % snapshot.feelings.length] || "love";
        candidates.push({
          id: newId(),
          uri: await prepareGeneratedImage(images[i].uri),
          feeling,
          selected: true,
          caption: snapshot.captions
            ? feelings.find((f) => f.id === feeling)!.caption
            : "",
          provenance: {
            kind: "imported",
            prompt: snapshot.prompt,
            look: snapshot.look,
            feeling,
          },
        });
      }
      update((d) => ({ ...d, candidates: [...d.candidates, ...candidates] }));
      setStep(2);
      setError("");
    });
  }
  async function makePack() {
    await store.run("Saving your favorites…", async () => {
      await store.flush();
      const pack = newCollection();
      pack.items = store
        .snapshot()
        .creations!.find((c) => c.id === id)!
        .candidates.filter((c) => c.selected)
        .map((c) => ({
          ...reaction(
            {
              ...defaultDesign(c.uri),
              shape: "cutout",
              decoration: "none",
              caption: c.caption,
              outline: 0,
            },
            {
              name:
                c.provenance.kind === "generated"
                  ? "AI-generated reaction"
                  : "Imported reaction",
            },
          ),
          tags: { fandom: "", member: "", era: "", emotion: c.feeling },
          provenance: { ...c.provenance },
        }));
      store.change((old) => ({
        ...old,
        collections: [pack, ...old.collections],
        assets: [
          ...old.assets,
          ...pack.items.map((i) => JSON.parse(JSON.stringify(i))),
        ],
        creations: old.creations?.map((d) =>
          d.id === id ? { ...d, saved: true } : d,
        ),
      }));
      router.push(`/pack/${pack.id}`);
      await store.flush();
    });
  }
  const viewed = draft.candidates.find((c) => c.id === inspect);
  return (
    <Shell
      back={() => router.push("/")}
      tab={false}
      scrollKey={step}
      footer={
        busy ? (
          <Action
            secondary
            label="Stop generation"
            onPress={() => active.current?.abort()}
          />
        ) : step === 0 ? (
          <Action
            label="Choose a look"
            icon={ArrowRight}
            disabled={!draft.prompt.trim()}
            onPress={() => setStep(1)}
          />
        ) : step === 1 ? (
          generationURL ? (
            <Action
              label={`Generate ${draft.feelings.length} reactions`}
              icon={Sparkles}
              disabled={!valid || full}
              onPress={() => requestGeneration(draft.feelings)}
            />
          ) : (
            <Action
              label="Import images to review"
              icon={ImagePlus}
              disabled={full}
              onPress={importResults}
            />
          )
        ) : (
          <Action
            label={`Make pack with ${chosen.length} favorites`}
            disabled={!chosen.length}
            onPress={makePack}
          />
        )
      }
    >
      <View style={[v.row, { justifyContent: "space-between" }]}>
        <T style={v.eyebrow}>THE REACTION LAB</T>
        <T style={[v.small, { flex: 1, textAlign: "right", fontSize: 10 }]}>
          {step === 2
            ? "REVIEW BEFORE SHARING"
            : "A LITTLE IDEA. A WHOLE MOOD."}
        </T>
      </View>
      <View style={v.row}>
        {["Your idea", "The vibe", "Favorites"].map((label, i) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={`Step ${i + 1}: ${label}`}
            accessibilityState={{ selected: step === i, disabled: !!busy }}
            disabled={!!busy}
            onPress={() => setStep(i)}
            style={{ flex: 1, gap: 7, minHeight: 44 }}
          >
            <View
              style={{
                height: 4,
                borderRadius: 4,
                backgroundColor: i <= step ? K.purple : K.line,
              }}
            />
            <T style={{ fontSize: 12, color: step === i ? K.purple : K.muted }}>
              {i + 1} · {label}
            </T>
          </Pressable>
        ))}
      </View>
      {step === 0 && (
        <>
          <View style={{ gap: 8 }}>
            <T style={v.title}>What’s your{"\n"}next obsession?</T>
            <T style={v.sub}>
              Start with a character, a photo, or an inside joke. We’ll build
              the reactions around it.
            </T>
          </View>
          <View
            style={[
              v.card,
              { backgroundColor: "#F1EBFC", borderColor: "#DBCEEF" },
            ]}
          >
            <View style={v.row}>
              <Sparkles color={K.purple} size={18} />
              <T style={{ fontFamily: "DMSans_700Bold" }}>
                Describe your sticker character
              </T>
            </View>
            <TextInput
              accessibilityLabel="Sticker idea"
              placeholder="A lavender cat with a star hair clip, living its concert era…"
              placeholderTextColor={K.muted}
              multiline
              maxLength={1200}
              value={draft.prompt}
              onChangeText={(prompt) => update((d) => ({ ...d, prompt }))}
              style={[
                v.input,
                {
                  minHeight: 132,
                  textAlignVertical: "top",
                  borderWidth: 0,
                  backgroundColor: "#FFFFFFA8",
                  lineHeight: 24,
                },
              ]}
            />
            <T style={v.small}>
              Be specific about the features you want to keep.
            </T>
          </View>
          <View style={v.wrap}>
            {[
              "A lavender cat with a star hair clip",
              "A tiny concert lightstick mascot",
              "A sleepy moon in an oversized hoodie",
            ].map((prompt, i) => (
              <Chip
                key={prompt}
                label={["Concert cat", "Lightstick buddy", "Sleepy moon"][i]}
                onPress={() => update((d) => ({ ...d, prompt }))}
              />
            ))}
          </View>
          <View style={v.card}>
            <View style={[v.row, { justifyContent: "space-between" }]}>
              <T style={v.section}>Bring a reference</T>
              <T style={v.small}>OPTIONAL</T>
            </View>
            {draft.reference && (
              <View style={{ alignItems: "center" }}>
                <Art
                  size={130}
                  design={{
                    ...defaultDesign(draft.reference),
                    decoration: "none",
                  }}
                />
              </View>
            )}
            <T style={v.sub}>
              A clear face or character helps guide the look. AI may change
              details; review the likeness before sharing.
            </T>
            <Action
              secondary
              label={
                draft.reference
                  ? "Change reference photo"
                  : "Add reference photo"
              }
              icon={ImagePlus}
              onPress={() =>
                store.run("Opening reference…", async () => {
                  const photos = await pickMany("photo", 1);
                  if (photos[0]) {
                    const reference = await prepareGeneratedImage(
                      photos[0].uri,
                    );
                    update((d) => ({ ...d, reference }));
                  }
                })
              }
            />
            {draft.reference && (
              <Action
                secondary
                label="Remove reference"
                onPress={() => update((d) => ({ ...d, reference: undefined }))}
              />
            )}
          </View>
          <T style={v.small}>
            Your brief saves on this device. Upload happens only when you
            confirm generation.
          </T>
        </>
      )}
      {step === 1 && (
        <>
          <View style={{ gap: 8 }}>
            <T style={v.title}>One look.{"\n"}Every feeling.</T>
            <T style={v.sub}>
              Choose a visual direction and the reactions you’ll actually send.
            </T>
          </View>
          <View style={v.wrap}>
            {looks.map((l, i) => (
              <Pressable
                key={l.id}
                accessibilityRole="button"
                accessibilityLabel={`Look: ${l.name}`}
                accessibilityState={{ selected: draft.look === l.id }}
                onPress={() => update((d) => ({ ...d, look: l.id }))}
                style={{
                  width: "48%",
                  flexGrow: 1,
                  borderRadius: 20,
                  padding: 13,
                  backgroundColor: l.color,
                  borderWidth: 2,
                  borderColor: draft.look === l.id ? K.purple : "transparent",
                  gap: 7,
                }}
              >
                <T
                  style={{
                    fontSize: 42,
                    color: K.ink,
                    fontFamily: i === 3 ? "serif" : "DMSans_800ExtraBold",
                  }}
                >
                  {["✹", "♡", "✿", "◒"][i]}
                </T>
                <T style={{ fontFamily: "DMSans_700Bold", fontSize: 16 }}>
                  {l.name}
                  {draft.look === l.id ? " ✓" : ""}
                </T>
                <T style={{ fontSize: 11, lineHeight: 16, color: K.ink }}>
                  {l.detail}
                </T>
              </Pressable>
            ))}
          </View>
          <T style={v.small}>
            Style directions, not generated previews. Results will vary.
          </T>
          <View style={{ gap: 12 }}>
            <T style={v.section}>Build your reaction lineup</T>
            <View style={v.wrap}>
              {feelings.map((f) => (
                <Chip
                  key={f.id}
                  label={`${f.emoji} ${f.label}`}
                  selected={draft.feelings.includes(f.id)}
                  onPress={() =>
                    update((d) => ({
                      ...d,
                      feelings: d.feelings.includes(f.id)
                        ? d.feelings.filter((x) => x !== f.id)
                        : [...d.feelings, f.id],
                    }))
                  }
                />
              ))}
            </View>
          </View>
          <Chip
            label="Add editable reaction captions"
            selected={draft.captions}
            onPress={() => update((d) => ({ ...d, captions: !d.captions }))}
          />
          <View
            style={[v.card, { backgroundColor: K.ink, borderColor: K.ink }]}
          >
            <T
              style={{
                color: "white",
                fontFamily: "DMSans_700Bold",
                fontSize: 18,
              }}
            >
              {draft.feelings.length} reactions · {look.name}
            </T>
            <T style={{ color: "#DED3EF", lineHeight: 22 }}>
              Each reaction is a separate image. Keep your favorites and try
              another version of just the ones you want.
            </T>
          </View>
          {!generationURL && (
            <View style={v.card}>
              <T style={v.section}>Bring your AI creations here</T>
              <T style={v.sub}>
                In-app generation isn’t connected in this build. Use the brief
                below in your image tool, then import individual results to
                build an editable pack.
              </T>
            </View>
          )}
          <Action
            secondary
            label={
              showPrompt ? "Hide generation brief" : "View generation brief"
            }
            onPress={() => setShowPrompt(!showPrompt)}
          />
          {showPrompt && (
            <View style={v.card}>
              <T selectable style={v.small}>
                {generationPrompt(draft, draft.feelings[0] || "love")}
              </T>
              <T style={v.small}>
                This brief describes one reaction. Change the reaction for each
                additional image.
              </T>
            </View>
          )}
          {generationURL && (
            <Action
              secondary
              label="Import results from another tool"
              disabled={full}
              onPress={importResults}
            />
          )}
        </>
      )}
      {step === 2 && (
        <>
          <View style={{ gap: 8 }}>
            <T style={v.title}>Keep the ones{"\n"}that feel like you.</T>
            <T style={v.sub}>
              {chosen.length} favorites selected. Check faces, hands and
              details. Captions stay editable in your pack.
            </T>
          </View>
          {!!busy && (
            <View
              accessibilityLiveRegion="polite"
              style={[v.card, { backgroundColor: K.lavender }]}
            >
              <View style={v.row}>
                <ActivityIndicator color={K.purple} />
                <T style={{ fontFamily: "DMSans_700Bold", flex: 1 }}>{busy}</T>
              </View>
              <T style={v.small}>
                Finished images save one at a time. Keep this screen open; you
                can stop without losing completed results.
              </T>
            </View>
          )}
          {!!error && (
            <View
              accessibilityRole="alert"
              style={[v.card, { backgroundColor: "#FFF0DF" }]}
            >
              <T style={v.sub}>{error}</T>
            </View>
          )}
          {!draft.candidates.length && !busy && (
            <View
              style={[
                v.card,
                { backgroundColor: K.lavender, paddingVertical: 32 },
              ]}
            >
              <T style={v.section}>A space for your possibilities</T>
              <T style={v.sub}>
                Generate your reaction lineup or import individual images from
                your favorite AI tool. Nothing is shared automatically.
              </T>
              <Action
                secondary
                label="Import images to review"
                icon={ImagePlus}
                onPress={importResults}
              />
            </View>
          )}
          <View style={v.wrap}>
            {draft.candidates.map((c, i) => (
              <View
                key={c.id}
                style={{
                  width: "48%",
                  flexGrow: 1,
                  maxWidth: "49%",
                  gap: 8,
                  padding: 10,
                  borderRadius: 22,
                  borderWidth: 2,
                  borderColor: c.selected ? K.purple : K.line,
                  backgroundColor: c.selected ? K.lavender : "white",
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Favorite result ${i + 1}`}
                  accessibilityState={{ selected: c.selected }}
                  onPress={() =>
                    update((d) => ({
                      ...d,
                      candidates: d.candidates.map((x) =>
                        x.id === c.id ? { ...x, selected: !x.selected } : x,
                      ),
                    }))
                  }
                  style={{ alignItems: "center", minHeight: 155 }}
                >
                  <Art
                    size={Math.min(134, (width - 94) / 2)}
                    design={{
                      ...defaultDesign(c.uri),
                      shape: "cutout",
                      decoration: "none",
                      caption: c.caption,
                      outline: 0,
                    }}
                  />
                  <T style={{ fontFamily: "DMSans_700Bold", fontSize: 12 }}>
                    {c.selected ? "✓ " : "+ "}
                    {feelings.find((f) => f.id === c.feeling)!.label}
                  </T>
                </Pressable>
                <T
                  style={{ fontSize: 10, color: K.muted, textAlign: "center" }}
                >
                  {c.provenance.kind === "generated"
                    ? "AI GENERATED"
                    : "IMPORTED IMAGE"}
                </T>
                <Action
                  secondary
                  label={`Inspect ${i + 1}`}
                  onPress={() => {
                    setInspectReady(false);
                    setInspect(c.id);
                  }}
                />
              </View>
            ))}
          </View>
          {!busy && (
            <View style={{ gap: 10 }}>
              {generationURL && (
                <Action
                  secondary
                  label={
                    missing.length
                      ? `Generate ${missing.length} missing reactions`
                      : "Make another variation"
                  }
                  icon={RefreshCw}
                  disabled={!valid || full}
                  onPress={() =>
                    requestGeneration(
                      missing.length ? missing : [draft.feelings[0]],
                    )
                  }
                />
              )}
              {!!draft.candidates.length && (
                <Action
                  secondary
                  label="Import more results"
                  disabled={full}
                  onPress={importResults}
                />
              )}
              <Action
                secondary
                label="Adjust idea & style"
                onPress={() => setStep(0)}
              />
              <Action
                secondary
                label={draft.saved ? "Recipe saved ✓" : "Save this recipe"}
                disabled={draft.saved}
                onPress={() => update((d) => ({ ...d, saved: true }))}
              />
              {draft.saved && (
                <Action
                  secondary
                  label="Reuse recipe in a new creation"
                  onPress={() => {
                    const next = reuseRecipe(draft);
                    store.change((old) => ({
                      ...old,
                      creations: [next, ...(old.creations || [])],
                    }));
                    router.push(`/create/${next.id}`);
                  }}
                />
              )}
            </View>
          )}
          <T style={v.small}>
            Favorites become a new pack and editable library assets. Your
            unselected variations stay in this draft.
          </T>
        </>
      )}
      <Modal
        visible={!!connect}
        onShow={() => setConnectReady(true)}
        transparent
        animationType="slide"
        onRequestClose={() => setConnect(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#21183299",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          >
            <View style={[v.card, { padding: 24 }]}>
              <Sparkles color={K.purple} size={30} />
              <T style={v.section}>
                Ready to make {connect?.length} reactions?
              </T>
              <T style={v.sub}>
                Your description{draft.reference ? " and reference photo" : ""}{" "}
                will be sent through the studio service to OpenAI. Generation
                uses the studio’s API allowance; each retry is a new request.
              </T>
              <T style={v.small}>
                Studio access code · kept only for this screen session
              </T>
              <TextInput
                accessibilityLabel="Studio access code"
                editable={connectReady}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                value={token}
                onChangeText={setToken}
                style={v.input}
                placeholder="Enter your studio access code"
                placeholderTextColor={K.muted}
              />
              <T style={v.small}>
                Use the access code from your studio operator, not an OpenAI API
                key.
              </T>
              <Action
                label={`Send & generate ${connect?.length || 0}`}
                disabled={
                  !connectReady || !token.trim() || token.startsWith("sk-")
                }
                onPress={() => connect && generate(connect)}
              />
              <Action
                secondary
                label="Keep editing"
                onPress={() => setConnect(null)}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
      <Modal
        visible={!!viewed}
        onShow={() => setInspectReady(true)}
        transparent
        animationType="slide"
        onRequestClose={() => setInspect(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#211832BB",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View style={[v.card, { padding: 20 }]}>
            {viewed && (
              <>
                <T style={v.section}>A closer look</T>
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: K.lavender,
                    borderRadius: 18,
                  }}
                >
                  <Art
                    size={Math.min(280, width - 86)}
                    design={{
                      ...defaultDesign(viewed.uri),
                      shape: "cutout",
                      decoration: "none",
                      outline: 0,
                    }}
                  />
                </View>
                <TextInput
                  accessibilityLabel="Result caption"
                  editable={inspectReady}
                  value={viewed.caption}
                  maxLength={28}
                  onChangeText={(caption) =>
                    update((d) => ({
                      ...d,
                      candidates: d.candidates.map((c) =>
                        c.id === viewed.id ? { ...c, caption } : c,
                      ),
                    }))
                  }
                  style={v.input}
                />
                {generationURL && (
                  <Action
                    secondary
                    label="Try another of this reaction"
                    disabled={!!busy || !valid || full}
                    onPress={() => {
                      setInspect(null);
                      requestGeneration([viewed.feeling]);
                    }}
                  />
                )}
                <Action
                  label="Done inspecting"
                  onPress={() => setInspect(null)}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
    </Shell>
  );
}

import React, { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Action, Chip, Field, ReactionTile, Shell, v } from "../CreatorUI";
import { reuseRecipe } from "../creation/model";
import { T } from "../ui";
import { useWorkspace } from "../WorkspaceProvider";
import { appendItems, duplicate, matches, newCollection } from "../workspace";
export function LibraryScreen() {
  const store = useWorkspace();
  const { to } = useLocalSearchParams<{ to?: string }>();
  const [section, setSection] = useState<"reactions" | "recipes">("reactions");
  const [query, setQuery] = useState("");
  const [emotion, setEmotion] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const items = store.data.assets.filter((item) =>
    matches(item, query, emotion),
  );
  const emotions = [
    ...new Set(store.data.assets.map((i) => i.tags.emotion).filter(Boolean)),
  ];
  function reuse() {
    store.run("Reusing reactions…", async () => {
      const reused = store.data.assets
        .filter((a) => selected.includes(a.id))
        .map(duplicate);
      if (!reused.length) return;
      const pack =
        store.data.collections.find((p) => p.id === to) || newCollection();
      const updated = appendItems(pack, reused);
      store.change((old) => ({
        ...old,
        collections: old.collections.some((p) => p.id === pack.id)
          ? old.collections.map((p) => (p.id === pack.id ? updated : p))
          : [updated, ...old.collections],
      }));
      router.push(`/pack/${pack.id}`);
    });
  }
  return (
    <Shell back={to ? () => router.push(`/pack/${to}`) : undefined}>
      <T style={v.eyebrow}>THE GOOD ONES, KEPT CLOSE</T>
      <T style={v.title}>Your reaction library</T>
      <T style={v.sub}>
        Bring your favorites into the next pack. Reused reactions are
        independent copies, ready for a new mood.
      </T>
      {!to && (
        <View style={v.wrap}>
          <Chip
            label="Reactions"
            selected={section === "reactions"}
            onPress={() => setSection("reactions")}
          />
          <Chip
            label="AI recipes"
            selected={section === "recipes"}
            onPress={() => setSection("recipes")}
          />
        </View>
      )}
      {section === "recipes" ? (
        <View style={{ gap: 12 }}>
          <T style={v.sub}>
            Your character, reference, visual direction and reaction lineup.
            Start fresh without repeating the setup.
          </T>
          {(store.data.creations || []).filter((d) => d.saved).length ? (
            (store.data.creations || [])
              .filter((d) => d.saved)
              .map((d) => (
                <View key={d.id} style={v.card}>
                  <T style={v.section}>{d.prompt || "Untitled recipe"}</T>
                  <T style={v.small}>
                    {d.feelings.length} reactions · {d.look}
                    {d.reference ? " · reference saved" : ""}
                  </T>
                  <Action
                    label="Reuse recipe"
                    onPress={() => {
                      const next = reuseRecipe(d);
                      store.change((old) => ({
                        ...old,
                        creations: [next, ...(old.creations || [])],
                      }));
                      router.push(`/create/${next.id}`);
                    }}
                  />
                  <Action
                    secondary
                    label="Open creation"
                    onPress={() => router.push(`/create/${d.id}`)}
                  />
                  <Action
                    secondary
                    label="Unsave recipe"
                    onPress={() =>
                      store.change((old) => ({
                        ...old,
                        creations: old.creations?.map((c) =>
                          c.id === d.id ? { ...c, saved: false } : c,
                        ),
                      }))
                    }
                  />
                </View>
              ))
          ) : (
            <View style={v.card}>
              <T style={v.section}>Keep a recipe worth repeating</T>
              <T style={v.sub}>
                Save a recipe from the creation studio. It will be here for your
                next pack.
              </T>
              <Action
                secondary
                label="Back to home"
                onPress={() => router.push("/")}
              />
            </View>
          )}
        </View>
      ) : (
        <>
          <Field
            label="Search reactions"
            value={query}
            onChange={setQuery}
            maxLength={100}
            placeholder="Caption, fandom, member, era…"
          />
          {emotions.length > 0 && (
            <View style={v.wrap}>
              <Chip
                label="All emotions"
                selected={!emotion}
                onPress={() => setEmotion("")}
              />
              {emotions.map((e) => (
                <Chip
                  key={e}
                  label={e}
                  selected={emotion === e}
                  onPress={() => setEmotion(e)}
                />
              ))}
            </View>
          )}
          {store.data.assets.length > 0 && (
            <View style={v.wrap}>
              <Chip
                label="Select visible"
                onPress={() => setSelected(items.map((i) => i.id))}
              />
              <Chip label="Clear selection" onPress={() => setSelected([])} />
            </View>
          )}
          {!!selected.length && (
            <Action
              label={
                to
                  ? `Add ${selected.length} to pack`
                  : `New pack from ${selected.length} reactions`
              }
              onPress={reuse}
            />
          )}
          {items.length ? (
            <View style={v.wrap}>
              {items.map((item) => (
                <ReactionTile
                  key={item.id}
                  item={item}
                  selected={selected.includes(item.id)}
                  onPress={() =>
                    setSelected((old) =>
                      old.includes(item.id)
                        ? old.filter((id) => id !== item.id)
                        : [...old, item.id],
                    )
                  }
                >
                  <T numberOfLines={1} style={v.small}>
                    {[item.tags.fandom, item.tags.member, item.tags.emotion]
                      .filter(Boolean)
                      .join(" · ") || "Ready to reuse"}
                  </T>
                </ReactionTile>
              ))}
            </View>
          ) : (
            <View style={v.card}>
              <T style={v.section}>
                {store.data.assets.length
                  ? "No reactions match yet"
                  : "A home for your signature reactions"}
              </T>
              <T style={v.sub}>
                {store.data.assets.length
                  ? "Try a different name, caption, or emotion."
                  : "In a pack, select your favorites and tap Save to library. Editable images, cutouts, captions and tags come with them."}
              </T>
            </View>
          )}
          {store.data.styles.length > 0 && (
            <>
              <T style={v.section}>Your signature styles</T>
              <View style={v.wrap}>
                {store.data.styles.map((s) => (
                  <View key={s.id} style={v.chip}>
                    <T style={{ color: s.style.color, fontSize: 22 }}>✦</T>
                    <T>{s.name}</T>
                  </View>
                ))}
              </View>
              <T style={v.small}>
                Apply a saved style from any pack’s Style selected panel.
              </T>
            </>
          )}
        </>
      )}
    </Shell>
  );
}

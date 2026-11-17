import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  AppState,
  Modal,
  Platform,
  View,
} from "react-native";
import { SvgXml } from "react-native-svg";
import { Collection, emptyWorkspace, Workspace } from "./workspace";
import { loadWorkspace, saveWorkspace, SaveQueue } from "./workspace-storage";
import { Sticker, StickerDesign } from "./domain";
import { discardSticker, imageData, renderSticker } from "./media";
import { scene } from "./scene";
import { Button, T } from "./ui";

type Store = {
  data: Workspace;
  snapshot: () => Workspace;
  change: (fn: (old: Workspace) => Workspace) => void;
  updatePack: (id: string, fn: (pack: Collection) => Collection) => void;
  undo: () => void;
  canUndo: boolean;
  status: string;
  flush: () => Promise<void>;
  run: (label: string, fn: () => Promise<void>) => Promise<void>;
  notice: (message: string) => void;
  render: (pack: Collection) => Promise<Sticker[]>;
};
const Context = createContext<Store>(null!);
export const useWorkspace = () => useContext(Context);
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState(emptyWorkspace);
  const current = useRef(data);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [status, setStatus] = useState("Saved on this device");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const locked = useRef(false);
  const [rendering, setRendering] = useState<StickerDesign | null>(null);
  const capture = useRef<View>(null);
  const [renderKey, setRenderKey] = useState(0);
  const pendingRender = useRef<null | (() => void)>(null);
  const history = useRef<Workspace[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const queue = useRef(new SaveQueue(saveWorkspace));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revision = useRef(0);
  const saved = useRef(0);
  async function boot() {
    setLoadError("");
    try {
      const loaded = await loadWorkspace();
      current.current = loaded;
      setData(loaded);
      setReady(true);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Unable to open your workspace.",
      );
    }
  }
  useEffect(() => {
    void boot();
  }, []);
  async function flush() {
    if (timer.current) clearTimeout(timer.current);
    const rev = revision.current;
    if (saved.current === rev) return;
    const snapshot = current.current;
    try {
      await queue.current.save(snapshot);
      saved.current = Math.max(saved.current, rev);
      if (revision.current === rev) setStatus("Saved on this device");
    } catch (e) {
      setStatus("Not saved · tap to retry");
      throw e;
    }
  }
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") void flushRef.current().catch(() => {});
    });
    return () => {
      sub.remove();
      if (timer.current) clearTimeout(timer.current);
      void flushRef.current().catch(() => {});
    };
  }, []);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const leave = (event: BeforeUnloadEvent) => {
      if (saved.current !== revision.current) {
        void flushRef.current().catch(() => {});
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, []);
  function install(next: Workspace) {
    current.current = next;
    setData(next);
    revision.current++;
    setStatus("Saving…");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () => void flushRef.current().catch(() => {}),
      250,
    );
  }
  function change(fn: (old: Workspace) => Workspace) {
    const next = fn(current.current);
    history.current = [...history.current.slice(-19), current.current];
    setCanUndo(true);
    install(next);
  }
  function undo() {
    const last = history.current.pop();
    if (last) install(last);
    setCanUndo(history.current.length > 0);
  }
  function updatePack(id: string, fn: (pack: Collection) => Collection) {
    change((old) => ({
      ...old,
      collections: old.collections.map((p) =>
        p.id === id ? { ...fn(p), updatedAt: Date.now() } : p,
      ),
    }));
  }
  async function run(label: string, fn: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Something went wrong. Your draft is safe. Try again.",
      );
    } finally {
      locked.current = false;
      setBusy("");
      setRendering(null);
    }
  }
  async function render(pack: Collection) {
    const result: Sticker[] = [];
    try {
      for (let i = 0; i < pack.items.length; i++) {
        setBusy(`Preparing sticker ${i + 1} of ${pack.items.length}…`);
        const design = { ...pack.items[i].design };
        if (Platform.OS !== "web") {
          design.source = await imageData(design.source);
          if (design.originalSource)
            design.originalSource = await imageData(design.originalSource);
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              pendingRender.current = null;
              reject(
                new Error(
                  "The sticker preview did not load. Please try again.",
                ),
              );
            }, 10000);
            pendingRender.current = () => {
              clearTimeout(timeout);
              resolve();
            };
            setRenderKey((k) => k + 1);
            setRendering(design);
          });
          // Wait for SVG image decode and the native drawing pass before view-shot.
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() =>
              requestAnimationFrame(() => setTimeout(resolve, 200)),
            ),
          );
        }
        result.push(await renderSticker(design, capture));
      }
      return result;
    } catch (e) {
      await Promise.all(result.map((s) => discardSticker(s).catch(() => {})));
      throw e;
    } finally {
      setRendering(null);
    }
  }
  if (!ready)
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 30, gap: 20 }}>
        {loadError ? (
          <>
            <T>{loadError}</T>
            <Button label="Retry opening workspace" onPress={boot} />
          </>
        ) : (
          <ActivityIndicator />
        )}
      </View>
    );
  return (
    <Context.Provider
      value={{
        data,
        snapshot: () => current.current,
        change,
        updatePack,
        undo,
        canUndo,
        status,
        flush,
        run,
        notice: setMessage,
        render,
      }}
    >
      {children}
      <Modal
        visible={!!busy}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#211832DD",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "#FAF8FF",
              borderRadius: 28,
              padding: 24,
              alignItems: "center",
              gap: 16,
            }}
          >
            <ActivityIndicator color="#6541C1" />
            <T accessibilityLiveRegion="polite">{busy}</T>
            {rendering && (
              <View
                ref={capture}
                collapsable={false}
                style={{ width: 280, height: 280 }}
              >
                <SvgXml
                  key={renderKey}
                  xml={scene(rendering, undefined, "export", Platform.OS)}
                  width="100%"
                  height="100%"
                  onLoad={() => {
                    pendingRender.current?.();
                    pendingRender.current = null;
                  }}
                />
              </View>
            )}
            <T style={{ fontSize: 12 }}>Your draft stays on this device.</T>
          </View>
        </View>
      </Modal>
      <Modal
        visible={!!message}
        transparent
        animationType="fade"
        onRequestClose={() => setMessage("")}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#21183299",
            justifyContent: "center",
            padding: 28,
          }}
        >
          <View
            style={{
              padding: 24,
              borderRadius: 24,
              backgroundColor: "white",
              gap: 20,
            }}
          >
            <T style={{ fontSize: 18, lineHeight: 27 }}>{message}</T>
            <Button label="Got it" onPress={() => setMessage("")} />
          </View>
        </View>
      </Modal>
    </Context.Provider>
  );
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  emptyWorkspace,
  migrate,
  validWorkspace,
  Workspace,
} from "./workspace";
export const WORKSPACE_KEY = "bias-studio.workspace.v2";
export async function loadWorkspace(): Promise<Workspace> {
  const current = await AsyncStorage.getItem(WORKSPACE_KEY);
  const raw = current ?? (await AsyncStorage.getItem("bias-studio.library.v1"));
  if (!raw) return emptyWorkspace();
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(
      "Your saved workspace could not be read. It has been kept intact.",
    );
  }
  const workspace = migrate(value);
  // The original v1 key is deliberately never changed or deleted.
  if (!current) await saveWorkspace(workspace);
  return workspace;
}
export async function saveWorkspace(workspace: Workspace) {
  if (!validWorkspace(workspace))
    throw new Error(
      "This change could not be saved. Your previous workspace is safe.",
    );
  try {
    await AsyncStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
  } catch (error) {
    if (error instanceof Error && /quota/i.test(error.message))
      throw new Error(
        "Device storage is full. Your unsaved work is still open. Free space, then tap the save status to retry before closing.",
      );
    throw error;
  }
}
export { SaveQueue } from "./save-queue";

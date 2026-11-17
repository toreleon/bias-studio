import AsyncStorage from "@react-native-async-storage/async-storage";
import { Library, isLibrary } from "./domain";
const KEY = "bias-studio.library.v1";
export async function loadLibrary(): Promise<Library | null> {
  const value = await AsyncStorage.getItem(KEY);
  if (!value) return null;
  let library: unknown;
  try {
    library = JSON.parse(value);
  } catch {
    throw new Error(
      "Your saved library could not be read. It has been kept intact.",
    );
  }
  if (!isLibrary(library))
    throw new Error(
      "Your saved library could not be read. It has been kept intact.",
    );
  return library;
}
export async function saveLibrary(library: Library) {
  await AsyncStorage.setItem(KEY, JSON.stringify(library));
}

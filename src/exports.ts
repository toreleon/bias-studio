import { Pack, Sticker } from "./domain";
import { Collection, title } from "./workspace";
/** Destination adapters accept validated rendered files; editor state stays destination-independent. */
export interface Destination {
  id: string;
  label: string;
  min: number;
  max: number;
  send: (pack: Pack) => Promise<void>;
}
export async function handoff(
  collection: Collection,
  stickers: Sticker[],
  destination: Destination,
) {
  if (stickers.length < destination.min || stickers.length > destination.max)
    throw new Error(
      `${destination.label} needs ${destination.min}–${destination.max} stickers.`,
    );
  if (stickers.length !== collection.items.length)
    throw new Error(
      "Some stickers could not be prepared. Your draft is safe. Try again.",
    );
  await destination.send({
    id: collection.id,
    name: title(collection),
    publisher: collection.publisher.trim() || "Bias Studio creator",
    color: collection.color,
    updatedAt: collection.updatedAt,
    stickers,
  });
  return { status: "handoff" as const }; // No destination installation acknowledgement is available.
}

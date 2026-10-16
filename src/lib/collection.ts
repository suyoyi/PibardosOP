import "server-only";
import { getDeckWorkspace, readAll, type AppClient } from "./data";
export async function getCollectionWorkspace(db: AppClient) {
  const [workspace, items, allocations, wishes] = await Promise.all([
    getDeckWorkspace(db),
    readAll((a, b) =>
      db.from("collection_items").select("*").order("id").range(a, b),
    ),
    readAll((a, b) =>
      db.from("collection_allocations").select("*").order("id").range(a, b),
    ),
    readAll((a, b) =>
      db.from("wishlist_items").select("*").order("id").range(a, b),
    ),
  ]);
  return { ...workspace, items, allocations, wishes };
}
export type CollectionWorkspace = Awaited<
  ReturnType<typeof getCollectionWorkspace>
>;
export function deckRequirements(w: CollectionWorkspace, deckId: string) {
  const deck = w.decks.find((d) => d.id === deckId),
    version = w.versions.find((v) => v.id === deck?.current_version_id);
  if (!deck || !version)
    throw new Error("El mazo o su versión ya no está disponible.");
  return {
    deck,
    version,
    requirements: [
      { card_id: version.leader_card_id, quantity: 1, role: "leader" },
      ...w.entries
        .filter((e) => e.deck_version_id === version.id)
        .map((e) => ({
          card_id: e.card_id,
          quantity: e.quantity,
          role: e.role,
        })),
    ],
  };
}

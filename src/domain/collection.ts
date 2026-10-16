import { z } from "zod";
import { canonicalGroups, type Card } from "./cards";
import type { Database } from "@/lib/supabase/database.types";
export type CollectionItem =
  Database["public"]["Tables"]["collection_items"]["Row"];
export type Allocation =
  Database["public"]["Tables"]["collection_allocations"]["Row"];
export type WishlistItem =
  Database["public"]["Tables"]["wishlist_items"]["Row"];
export const inventorySchema = z
  .object({
    id: z.uuid(),
    expected_updated_at: z.string().max(60).nullable(),
    quantity_owned: z.number().int().min(0).max(9999),
    quantity_tradeable: z.number().int().min(0).max(9999),
    finish: z.string().trim().min(1).max(80),
    storage_location: z.string().trim().max(200),
  })
  .strict()
  .refine(
    (i) => i.quantity_tradeable <= i.quantity_owned,
    "No puedes ofrecer más copias de las que tienes.",
  );
export const wishSchema = z
  .object({
    id: z.uuid(),
    expected_updated_at: z.string().max(60).nullable(),
    target_quantity: z.number().int().min(1).max(9999),
    priority: z.enum(["high", "normal", "low"]),
    notes: z.string().trim().max(3000),
  })
  .strict();
export const priorityLabels = { high: "Alta", normal: "Normal", low: "Baja" };
export function reservedQuantity(
  itemId: string,
  allocations: readonly Allocation[],
) {
  return allocations
    .filter((a) => a.collection_item_id === itemId)
    .reduce((n, a) => n + a.quantity, 0);
}
export function availableQuantity(
  item: CollectionItem,
  allocations: readonly Allocation[],
) {
  return Math.max(
    0,
    item.quantity_owned -
      item.quantity_tradeable -
      reservedQuantity(item.id, allocations),
  );
}
export function ownedPrintingQuantity(
  cardId: string,
  items: readonly CollectionItem[],
) {
  return items
    .filter((i) => i.card_id === cardId && i.language === "en")
    .reduce((n, i) => n + i.quantity_owned, 0);
}
export function wishRemaining(
  wish: WishlistItem,
  items: readonly CollectionItem[],
) {
  return Math.max(
    0,
    wish.target_quantity - ownedPrintingQuantity(wish.card_id, items),
  );
}
export type PhysicalRequirement = {
  card_id: string;
  quantity: number;
  role: string;
};
export function deckCollectionNeeds(
  deckId: string,
  requirements: readonly PhysicalRequirement[],
  cards: readonly Card[],
  items: readonly CollectionItem[],
  allocations: readonly Allocation[],
) {
  const groups = canonicalGroups(cards),
    needs = new Map<
      string,
      { card: Card; required: number; roles: string[] }
    >();
  for (const entry of requirements) {
    const card = cards.find((c) => c.id === entry.card_id);
    if (!card)
      throw new Error("No se pudieron recuperar las cartas de la versión.");
    const key = groups.get(card.id) ?? card.id,
      prior = needs.get(key);
    if (prior) {
      prior.required += entry.quantity;
      if (!prior.roles.includes(entry.role)) prior.roles.push(entry.role);
    } else
      needs.set(key, { card, required: entry.quantity, roles: [entry.role] });
  }
  return [...needs].map(([key, need]) => {
    const lots = items.filter(
      (i) =>
        i.language === "en" && (groups.get(i.card_id) ?? i.card_id) === key,
    );
    const reserved = lots.reduce(
      (n, i) =>
        n +
        allocations
          .filter((a) => a.collection_item_id === i.id && a.deck_id === deckId)
          .reduce((sum, a) => sum + a.quantity, 0),
      0,
    );
    const free = lots.reduce(
      (n, i) => n + availableQuantity(i, allocations),
      0,
    );
    return {
      ...need,
      key,
      reserved,
      free,
      missing: Math.max(0, need.required - reserved - free),
      surplus: Math.max(0, reserved - need.required),
    };
  });
}
export function planDeckAllocations(
  deckId: string,
  requirements: readonly PhysicalRequirement[],
  cards: readonly Card[],
  items: readonly CollectionItem[],
  allocations: readonly Allocation[],
) {
  const groups = canonicalGroups(cards),
    planned: { collection_item_id: string; quantity: number }[] = [];
  for (const need of deckCollectionNeeds(
    deckId,
    requirements,
    cards,
    items,
    allocations,
  )) {
    let remaining = need.required;
    const ownReserved = (i: CollectionItem) =>
      allocations
        .filter((a) => a.collection_item_id === i.id && a.deck_id === deckId)
        .reduce((n, a) => n + a.quantity, 0);
    const lots = items
      .filter((i) => i.language === "en" && groups.get(i.card_id) === need.key)
      .sort(
        (a, b) =>
          Number(ownReserved(b) > 0) - Number(ownReserved(a) > 0) ||
          Number(b.card_id === need.card.id) -
            Number(a.card_id === need.card.id) ||
          a.id.localeCompare(b.id),
      );
    for (const item of lots) {
      const quantity = Math.min(
        remaining,
        availableQuantity(item, allocations) + ownReserved(item),
      );
      if (quantity > 0) {
        planned.push({ collection_item_id: item.id, quantity });
        remaining -= quantity;
      }
      if (!remaining) break;
    }
  }
  return planned;
}

import { it, expect } from "vitest";
import { syntheticCard } from "../fixtures/cards";
import {
  availableQuantity,
  deckCollectionNeeds,
  planDeckAllocations,
  wishRemaining,
  inventorySchema,
  wishSchema,
  type CollectionItem,
  type Allocation,
  type WishlistItem,
} from "../../src/domain/collection";
const leader = syntheticCard(1, { card_type: "leader" }),
  base = syntheticCard(2),
  alt = syntheticCard(3, {
    card_number: base.card_number,
    canonical_card_id: base.id,
    printing_code: "alternate",
  }),
  reprint = syntheticCard(4, {
    card_number: "ST00-001",
    canonical_card_id: base.id,
  }),
  don = syntheticCard(5, { card_number: "DON!!", card_type: "don" });
const cards = [leader, base, alt, reprint, don],
  deck = "deck-a";
function lot(
  id: string,
  card_id = base.id,
  quantity_owned = 4,
  quantity_tradeable = 0,
): CollectionItem {
  return {
    id,
    card_id,
    quantity_owned,
    quantity_tradeable,
    language: "en",
    finish: "standard",
    storage_location: "Box",
    user_id: "user",
    created_at: "2026-10-15T00:00:00Z",
    updated_at: "2026-10-15T00:00:00Z",
  };
}
function allocation(
  id: string,
  collection_item_id: string,
  deck_id: string,
  quantity: number,
): Allocation {
  return { id, collection_item_id, deck_id, quantity, user_id: "user" };
}
const main = [{ card_id: base.id, quantity: 4, role: "main" }];
it("does not infer ownership from virtual deck contents or a wish", () => {
  expect(deckCollectionNeeds(deck, main, cards, [], [])[0].missing).toBe(4);
  expect(planDeckAllocations(deck, main, cards, [], [])).toEqual([]);
});
it("subtracts tradeable and other decks' reserved copies without double counting this deck's copies", () => {
  const items = [lot("a", base.id, 6, 1)],
    allocations = [
      allocation("r1", "a", deck, 2),
      allocation("r2", "a", "other", 2),
    ];
  expect(availableQuantity(items[0], allocations)).toBe(1);
  expect(
    deckCollectionNeeds(deck, main, cards, items, allocations)[0],
  ).toMatchObject({ reserved: 2, free: 1, missing: 1 });
  expect(planDeckAllocations(deck, main, cards, items, allocations)).toEqual([
    { collection_item_id: "a", quantity: 3 },
  ]);
});
it("accepts alternate art and canonical reprints for a deck but keeps exact-art wishes independent", () => {
  const items = [lot("alt", alt.id, 2), lot("reprint", reprint.id, 2)];
  expect(deckCollectionNeeds(deck, main, cards, items, [])[0].missing).toBe(0);
  const wish = { card_id: base.id, target_quantity: 4 } as WishlistItem;
  expect(wishRemaining(wish, items)).toBe(4);
  expect(wishRemaining(wish, [...items, lot("base", base.id, 5)])).toBe(0);
});
it("combines duplicate canonical needs before spending a physical lot", () => {
  const needs = [
    { card_id: base.id, quantity: 2, role: "main" },
    { card_id: alt.id, quantity: 2, role: "main" },
  ];
  expect(
    deckCollectionNeeds(deck, needs, cards, [lot("a", reprint.id, 3)], []),
  ).toHaveLength(1);
  expect(
    planDeckAllocations(deck, needs, cards, [lot("a", reprint.id, 3)], []),
  ).toEqual([{ collection_item_id: "a", quantity: 3 }]);
});
it("includes the physical leader and separate DON deck without spending main-card copies twice", () => {
  const needs = [
    { card_id: leader.id, quantity: 1, role: "leader" },
    ...main,
    { card_id: don.id, quantity: 10, role: "don" },
  ];
  const result = deckCollectionNeeds(
    deck,
    needs,
    cards,
    [lot("l", leader.id, 1), lot("m", base.id, 4), lot("d", don.id, 8)],
    [],
  );
  expect(result.map((n) => n.missing)).toEqual([0, 0, 2]);
  expect(
    planDeckAllocations(deck, needs, cards, [lot("d", don.id, 8)], []),
  ).toEqual([{ collection_item_id: "d", quantity: 8 }]);
});
it("retains existing compatible physical lots before moving to a preferred artwork", () => {
  const items = [lot("base", base.id, 4), lot("alt", alt.id, 4)],
    allocations = [allocation("r", "alt", deck, 4)];
  expect(planDeckAllocations(deck, main, cards, items, allocations)).toEqual([
    { collection_item_id: "alt", quantity: 4 },
  ]);
  expect(
    planDeckAllocations(
      deck,
      [{ ...main[0], quantity: 2 }],
      cards,
      items,
      allocations,
    ),
  ).toEqual([{ collection_item_id: "alt", quantity: 2 }]);
  expect(
    deckCollectionNeeds(
      deck,
      [{ ...main[0], quantity: 2 }],
      cards,
      items,
      allocations,
    )[0].surplus,
  ).toBe(2);
});
it("separates storage lots and excludes non-English historical copies from English deck availability", () => {
  const items = [
    lot("a", base.id, 1),
    lot("b", base.id, 2),
    { ...lot("jp", base.id, 10), language: "ja" },
  ];
  expect(deckCollectionNeeds(deck, main, cards, items, [])[0].missing).toBe(1);
  expect(planDeckAllocations(deck, main, cards, items, [])).toEqual([
    { collection_item_id: "a", quantity: 1 },
    { collection_item_id: "b", quantity: 2 },
  ]);
});
it("is deterministic and reports unavailable facts rather than fabricating a card", () => {
  const input = [lot("b", base.id, 2), lot("a", base.id, 2)];
  expect(planDeckAllocations(deck, main, cards, input, [])).toEqual(
    planDeckAllocations(deck, main, cards, [...input].reverse(), []),
  );
  expect(() =>
    deckCollectionNeeds(
      deck,
      [{ card_id: "missing", quantity: 1, role: "main" }],
      cards,
      [],
      [],
    ),
  ).toThrow();
});
it("validates physical quantities, explicit targets and untrusted extra fields", () => {
  const item = {
    id: base.id,
    expected_updated_at: null,
    quantity_owned: 4,
    quantity_tradeable: 1,
    finish: "foil",
    storage_location: "Box",
  };
  expect(inventorySchema.safeParse(item).success).toBe(true);
  expect(
    inventorySchema.safeParse({ ...item, quantity_tradeable: 5 }).success,
  ).toBe(false);
  expect(
    inventorySchema.safeParse({ ...item, quantity_owned: 1.5 }).success,
  ).toBe(false);
  expect(inventorySchema.safeParse({ ...item, user_id: base.id }).success).toBe(
    false,
  );
  const wish = {
    id: base.id,
    expected_updated_at: null,
    target_quantity: 4,
    priority: "high",
    notes: "Exact art",
  };
  expect(wishSchema.safeParse(wish).success).toBe(true);
  expect(wishSchema.safeParse({ ...wish, target_quantity: 0 }).success).toBe(
    false,
  );
});

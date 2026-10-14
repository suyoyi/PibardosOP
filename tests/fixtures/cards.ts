import type { Card } from "../../src/domain/cards";
export function syntheticCard(
  index: number,
  overrides: Partial<Card> = {},
): Card {
  const id = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
  return {
    id,
    canonical_card_id: id,
    user_id: null,
    card_number: `OP00-${String(index).padStart(3, "0")}`,
    name: `Synthetic fixture ${index}`,
    colors: ["red"],
    card_type: "character",
    cost: 2,
    power: null,
    counter: null,
    life: null,
    attribute: null,
    traits: [],
    effect_text: null,
    set_code: "OP00",
    rarity: null,
    language: "en",
    printing_code: "standard",
    image_url: null,
    source: "synthetic-test",
    source_updated_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}
export const leader = syntheticCard(1, { card_type: "leader" });
export const main = syntheticCard(2);
export const alternate = syntheticCard(3, {
  card_number: main.card_number,
  canonical_card_id: main.id,
  printing_code: "alternate",
});
export const don = syntheticCard(4, {
  card_number: "DON!!",
  card_type: "don",
  colors: [],
  cost: null,
});

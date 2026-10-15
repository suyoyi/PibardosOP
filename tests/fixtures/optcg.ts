// Synthetic provider responses, unrelated to actual One Piece cards/prices.
export function optcgRecord(overrides: Record<string, unknown> = {}) {
  return {
    card_set_id: "OP97-010",
    card_image_id: "OP97-010",
    card_name: "Synthetic OPTCG character",
    set_id: "OP-97",
    set_name: "Synthetic set",
    card_color: "Red",
    card_type: "Character",
    card_cost: "3",
    card_power: "5000",
    counter_amount: 1000,
    life: "NULL",
    sub_types: "Synthetic trait block",
    attribute: "Synthetic attribute",
    card_text: "Synthetic effect",
    rarity: "R",
    card_image: "https://optcgapi.com/media/static/Card_Images/OP97-010.jpg",
    market_price: 2.5,
    inventory_price: null,
    date_scraped: "2026-01-02",
    ...overrides,
  };
}

// Synthetic price-history fields in provider order; no inferred calendar dates.
export function optcgHistoryRecord(overrides: Record<string, unknown> = {}) {
  const points = Object.fromEntries(
    Array.from({ length: 13 }, (_, i) => [
      [`Day${i + 1}_Market_Price`, Number((1 + (i + 1) / 10).toFixed(2))],
      [`Day${i + 1}_Inventory_Price`, Number((2 + (i + 1) / 10).toFixed(2))],
    ]).flat(),
  );
  return optcgRecord({ ...points, ...overrides });
}

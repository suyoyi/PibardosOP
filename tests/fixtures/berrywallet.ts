// Synthetic API records; these do not represent any real One Piece card.
export function berryRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "op_synthetic_printing_a",
    card_number: "OP97-010",
    name: "Synthetic provider character",
    sub_type_name: "Synthetic edition",
    card_type: "Character",
    ext_color: "Red / Green",
    ext_cost: "3",
    ext_power: "5000",
    ext_counterplus: "1000",
    ext_life: null,
    ext_subtypes: "Synthetic trait; Test trait",
    ext_attribute: "Synthetic attribute",
    ext_description: "Synthetic fixture text",
    set_code: "OP97",
    tcgplayer: { prices: { low_price: 1.25, market_price: null } },
    cardmarket: { prices: { avg: 2.5, low: 1, trend: null } },
    ...overrides,
  };
}

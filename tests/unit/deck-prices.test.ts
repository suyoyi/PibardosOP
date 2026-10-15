import { expect, it } from "vitest";
import { syntheticCard } from "../fixtures/cards";
import {
  buildDeckDisplay,
  formatDeckAmount,
  type SavedDeckQuote,
} from "../../src/domain/deck-prices";
import type { Card } from "../../src/domain/cards";
const card = (id: number, overrides: Partial<Card> = {}) =>
  syntheticCard(id, {
    source: "optcgapi",
    provider_card_id: `optcg_sets_OP00-${String(id).padStart(3, "0")}`,
    ...overrides,
  });
const leader = card(1, { card_type: "leader" }),
  base = card(2),
  alt = card(3, {
    card_number: base.card_number,
    canonical_card_id: base.id,
    printing_code: "parallel",
  }),
  don = card(4, { card_type: "don", card_number: "DON!!" });
function quote(c: Card, amount: number): SavedDeckQuote {
  return {
    card_id: c.id,
    external_id: c.provider_card_id!,
    fetched_at: "2026-10-15T12:00:00Z",
    source_date: "2026-10-14",
    prices: [{ metric: "market_price", amount, currency: null }],
  };
}
const entries = [
  { card_id: base.id, quantity: 4, role: "main" as const },
  { card_id: alt.id, quantity: 2, role: "main" as const },
  { card_id: don.id, quantity: 10, role: "don" as const },
];
const cards = [leader, base, alt, don];
it("weights exact artwork prices by quantity and includes leader and separate DON", () => {
  const d = buildDeckDisplay(leader.id, entries, cards, [
    quote(leader, 2),
    quote(base, 2.5),
    quote(alt, 11),
    quote(don, 0.1),
  ]);
  expect(d.total).toMatchObject({
    amount: "35",
    copies: 17,
    pricedCopies: 17,
    printings: 4,
    pricedPrintings: 4,
    complete: true,
  });
  expect(d.groups.map((g) => [g.role, g.amount, g.copies])).toEqual([
    ["leader", "2", 1],
    ["main", "32", 6],
    ["don", "1", 10],
  ]);
  expect(d.rows.find((r) => r.card.id === base.id)).toMatchObject({
    unitPrice: "2.5",
    lineTotal: "10",
  });
  expect(d.rows.find((r) => r.card.id === alt.id)).toMatchObject({
    unitPrice: "11",
    lineTotal: "22",
  });
});
it("keeps genuine zero distinct from missing market prices and reports incomplete coverage", () => {
  const inventory = {
    ...quote(base, 99),
    prices: [{ metric: "inventory_price", amount: 99, currency: null }],
  };
  const d = buildDeckDisplay(leader.id, entries.slice(0, 1), cards, [
    quote(leader, 0),
    inventory,
  ]);
  expect(d.total).toMatchObject({
    amount: "0",
    copies: 5,
    pricedCopies: 1,
    complete: false,
  });
  expect(d.rows[0].unitPrice).toBe("0");
  expect(d.rows[1]).toMatchObject({ unitPrice: null, lineTotal: null });
  expect(d.rows[1].quote).toEqual(inventory);
});
it("does not value an alternate from its canonical base or another owner card ID", () => {
  const d = buildDeckDisplay(
    leader.id,
    [{ card_id: alt.id, quantity: 4, role: "main" }],
    cards,
    [
      quote(base, 99),
      { ...quote(alt, 11), card_id: "foreign-id" },
      { ...quote(alt, 10), external_id: base.provider_card_id! },
    ],
  );
  expect(d.total).toMatchObject({
    amount: null,
    pricedCopies: 0,
    copies: 5,
    complete: false,
  });
  expect(d.rows[1].unitPrice).toBeNull();
});
it("rejects invalid, duplicate, wrong-currency or ambiguous quotes rather than guessing", () => {
  const good = quote(leader, 1);
  for (const prices of [
    [{ metric: "market_price", amount: -1, currency: null }],
    [{ metric: "market_price", amount: "2.50", currency: null }],
    [{ metric: "market_price", amount: 2, currency: "USD" }],
    [{ metric: "market_price", amount: 1e11, currency: null }],
    [{ metric: "market_price", amount: Number.NaN, currency: null }],
    [
      { metric: "market_price", amount: 1, currency: null },
      { metric: "market_price", amount: 2, currency: null },
    ],
    { market_price: 1 },
  ]) {
    const d = buildDeckDisplay(leader.id, [], cards, [
      { ...good, prices } as SavedDeckQuote,
    ]);
    expect(d.total.amount).toBeNull();
  }
  expect(
    buildDeckDisplay(leader.id, [], cards, [good, good]).total.amount,
  ).toBeNull();
  expect(
    buildDeckDisplay(leader.id, [], [{ ...leader, source: "manual" }], [good])
      .total.amount,
  ).toBeNull();
});
it("sums decimals exactly and preserves tiny positive source values", () => {
  const d = buildDeckDisplay(
    leader.id,
    [
      { card_id: base.id, quantity: 3, role: "main" },
      { card_id: alt.id, quantity: 3, role: "main" },
    ],
    cards,
    [quote(leader, 0), quote(base, 0.1), quote(alt, 0.2)],
  );
  expect(d.total.amount).toBe("0.9");
  const tiny = buildDeckDisplay(
    leader.id,
    [{ card_id: base.id, quantity: 4, role: "main" }],
    cards,
    [quote(leader, 0), quote(base, 1e-9)],
  );
  expect(tiny.rows[1].lineTotal).toBe("0.000000004");
  expect(formatDeckAmount(tiny.rows[1].lineTotal)).toBe("0,000000004");
  expect(formatDeckAmount("0")).toBe("0,00");
  expect(formatDeckAmount("10")).toBe("10,00");
  expect(formatDeckAmount("0.9")).toBe("0,90");
  expect(formatDeckAmount(null)).toBe("Sin precio");
});
it("orders leader first, main cards by cost and DON last without mutating input", () => {
  const ordered = [leader, { ...base, cost: null }, { ...alt, cost: 0 }, don];
  const original = structuredClone(entries);
  const d = buildDeckDisplay(leader.id, entries, ordered, []);
  expect(d.rows.map((r) => r.card.id)).toEqual([
    leader.id,
    alt.id,
    base.id,
    don.id,
  ]);
  expect(entries).toEqual(original);
});
it("retains drafts and fails visibly if historical card facts are missing", () => {
  const d = buildDeckDisplay(leader.id, [], cards, []);
  expect(d.total).toMatchObject({
    copies: 1,
    pricedCopies: 0,
    amount: null,
    complete: false,
  });
  expect(d.groups.find((g) => g.role === "main")).toMatchObject({
    copies: 0,
    amount: "0",
    complete: true,
  });
  expect(() => buildDeckDisplay(leader.id, entries, [leader], [])).toThrow(
    "No se pudo recuperar",
  );
});
it("reports the oldest consulted quote actually used, excluding missing prices", () => {
  const d = buildDeckDisplay(leader.id, entries.slice(0, 1), cards, [
    { ...quote(leader, 2), fetched_at: "2026-10-15T14:00:00+02:00" },
    { ...quote(base, 2.5), fetched_at: "2026-10-15T11:00:00Z" },
    { ...quote(alt, 9), fetched_at: "2000-01-01T00:00:00Z" },
  ]);
  expect(d.total.oldestFetchedAt).toBe("2026-10-15T11:00:00Z");
});

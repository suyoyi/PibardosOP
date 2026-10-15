import { it, expect } from "vitest";
import { exploreCards } from "../../src/domain/card-explorer";
import { normalizeOptcgCard } from "../../src/domain/optcg";
import { optcgRecord } from "../fixtures/optcg";
import { syntheticCard } from "../fixtures/cards";

const at = "2026-10-15T12:00:00Z";
const base = normalizeOptcgCard(optcgRecord(), "sets");
const alt = normalizeOptcgCard(
  optcgRecord({
    card_image_id: "OP97-010_p1",
    counter_amount: 0,
    market_price: 0,
  }),
  "sets",
);
const reprint = normalizeOptcgCard(
  optcgRecord({
    card_image_id: "OP97-010_r1",
    set_id: "ST-97",
    set_name: "Synthetic starter",
    market_price: null,
  }),
  "promos",
);

it("browses the whole source without private imports and groups exact printings", () => {
  const result = exploreCards([], [alt, base, reprint], {}, 1, at);
  expect(result.total).toBe(1);
  expect(result.printings).toBe(3);
  expect(result.groups[0].printings.map((p) => p.candidate.kind)).toEqual([
    "remote",
    "remote",
    "remote",
  ]);
  expect(result.groups[0].printings[0].candidate.card).toBe(base);
  expect(
    result.groups[0].printings.find(
      (p) => p.candidate.card.set_code === "ST-97",
    ),
  ).toMatchObject({
    expansionName: "Synthetic starter",
    quote: { prices: [], fetchedAt: at },
  });
});

it("uses short-code and primary filters while keeping other artworks in the detail", () => {
  const result = exploreCards(
    [],
    [base, alt, reprint],
    { search: "op97-10", set: "ST97", color: "red", cost: "3" },
    1,
    at,
  );
  expect(result.total).toBe(1);
  expect(result.printings).toBe(1);
  expect(result.groups[0].printings[0].candidate.card).toBe(reprint);
  expect(result.groups[0].printings).toHaveLength(3);
});

it("filters advanced facts exactly, including zero counter, and keeps zero price distinct from absence", () => {
  const result = exploreCards(
    [],
    [base, alt],
    {
      counter: "0",
      power: "5000",
      type: "character",
      rarity: "R",
      attribute: "Synthetic attribute",
      trait: "Synthetic trait block",
    },
    1,
    at,
  );
  expect(result.printings).toBe(1);
  expect(result.groups[0].printings[0]).toMatchObject({
    candidate: { card: { external_id: alt.external_id } },
    quote: { prices: [{ amount: 0, currency: null }] },
  });
  expect(result.options.counter).toEqual(["0", "1000"]);
  expect(exploreCards([], [base], { power: "0" }, 1, at).total).toBe(0);
});

it("keeps private immutable facts, deduplicates cached previews and attaches only the exact quote", () => {
  const saved = syntheticCard(1, {
    source: "optcgapi",
    provider_card_id: alt.external_id,
    card_number: base.card_number,
    name: "Preserved name",
    cost: 0,
  });
  const result = exploreCards([saved], [base, alt], { cost: "0" }, 1, at);
  expect(result.printings).toBe(1);
  expect(result.groups[0].printings[0]).toMatchObject({
    candidate: {
      kind: "saved",
      card: { id: saved.id, name: "Preserved name", cost: 0 },
    },
    quote: { prices: [{ amount: 0 }] },
  });
  expect(result.groups[0].printings).toHaveLength(2);
});

it("retains English manual cards during an outage without fabricating names, prices or non-English choices", () => {
  const result = exploreCards(
    [syntheticCard(1), syntheticCard(2, { language: "ja" })],
    [],
    {},
    1,
    at,
  );
  expect(result.total).toBe(1);
  expect(result.groups[0].printings[0]).toMatchObject({
    expansionName: null,
    quote: null,
  });
  expect(result.options.expansions).toEqual([{ id: "OP00", name: null }]);
});

it("paginates across the full dataset rather than filtering one visible page, and handles empty pages", () => {
  const cards = Array.from({ length: 80 }, (_, i) => syntheticCard(i + 1));
  const last = exploreCards(cards, [], {}, 999, at);
  expect(last).toMatchObject({ total: 80, page: 3, pages: 3 });
  expect(last.groups).toHaveLength(8);
  const match = exploreCards(cards, [], { search: "OP00-080" }, 3, at);
  expect(match).toMatchObject({ total: 1, page: 1, pages: 1 });
  expect(exploreCards([], [], {}, 1, at)).toMatchObject({
    total: 0,
    page: 1,
    pages: 1,
    groups: [],
  });
});

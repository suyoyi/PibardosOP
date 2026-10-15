import { describe, expect, it } from "vitest";
import {
  buildDeckComparison,
  comparisonFiltersSchema,
  comparisonIdsSchema,
  type ComparisonMatch,
} from "../../src/domain/deck-comparison";
import { syntheticCard } from "../fixtures/cards";
const match = (overrides: Partial<ComparisonMatch> = {}): ComparisonMatch => ({
  deck_id: "a",
  deck_version_id: "v1",
  result: "win",
  opponent_leader_id: "rival",
  went_first: true,
  played_at: "2026-01-15T12:00:00Z",
  format: "standard",
  ...overrides,
});
describe("two-deck comparison", () => {
  it("aggregates actual played snapshots, isolates the two decks and keeps unequal denominators", () => {
    const matches = [
      match(),
      match({ deck_version_id: "v2" }),
      match({ result: "loss", went_first: false }),
      match({ deck_id: "b", result: "loss" }),
      match({ deck_id: "c" }),
    ];
    const before = structuredClone(matches),
      result = buildDeckComparison(matches, "a", "b");
    expect(result.sides[0].summary).toMatchObject({
      wins: 2,
      losses: 1,
      totalGames: 3,
      decisiveGames: 3,
      winRate: 2 / 3,
      lossRate: 1 / 3,
    });
    expect(result.sides[1].summary).toMatchObject({
      wins: 0,
      losses: 1,
      decisiveGames: 1,
      winRate: 0,
      lossRate: 1,
    });
    expect(result.sides[0].byOrder).toMatchObject([
      { decisiveGames: 2, winRate: 1, lossRate: 0 },
      { decisiveGames: 1, winRate: 0, lossRate: 1 },
    ]);
    expect(matches).toEqual(before);
  });
  it("applies one format and inclusive Madrid dates to both sides including DST boundaries", () => {
    const matches = [
      match({ played_at: "2026-03-28T23:00:00Z" }),
      match({ deck_id: "b", played_at: "2026-03-29T21:59:59Z" }),
      match({ played_at: "2026-03-28T22:59:59Z" }),
      match({ deck_id: "b", played_at: "2026-03-29T22:00:00Z" }),
      match({ format: "other" }),
    ];
    const result = buildDeckComparison(matches, "a", "b", {
      format: "standard",
      from: "2026-03-29",
      to: "2026-03-29",
    });
    expect(result.sides.map((s) => s.summary.totalGames)).toEqual([1, 1]);
    expect(
      buildDeckComparison(matches, "a", "b", { format: "other" }).sides.map(
        (s) => s.summary.totalGames,
      ),
    ).toEqual([1, 0]);
  });
  it("aligns opponents and months without inferring percentages for absent cohorts", () => {
    const result = buildDeckComparison(
      [
        match({ opponent_leader_id: "z", played_at: "2026-01-31T23:00:00Z" }),
        match({
          deck_id: "b",
          opponent_leader_id: "a",
          played_at: "2026-01-31T22:59:59Z",
        }),
      ],
      "a",
      "b",
    );
    expect(result.months.map((r) => r.label)).toEqual(["2026-01", "2026-02"]);
    expect(result.months[0].a).toMatchObject({ totalGames: 0, winRate: null });
    expect(result.months[1].b).toMatchObject({ totalGames: 0, winRate: null });
    expect(result.opponents.map((r) => r.label)).toEqual(["a", "z"]);
    expect(result.opponents[0].a.decisiveGames).toBe(0);
  });
  it("groups alternate artworks, shared printed codes and canonical reprints for rival leaders", () => {
    const root = syntheticCard(1, { card_type: "leader" }),
      alt = syntheticCard(2, {
        card_type: "leader",
        canonical_card_id: root.id,
        card_number: root.card_number,
      }),
      reprint = syntheticCard(3, {
        card_type: "leader",
        canonical_card_id: root.id,
      });
    const result = buildDeckComparison(
      [
        match({ opponent_leader_id: root.id }),
        match({ opponent_leader_id: alt.id, result: "loss" }),
        match({ deck_id: "b", opponent_leader_id: reprint.id }),
      ],
      "a",
      "b",
      {},
      [root, alt, reprint],
    );
    expect(result.opponents).toHaveLength(1);
    expect(result.opponents[0].a).toMatchObject({
      wins: 1,
      losses: 1,
      winRate: 0.5,
    });
    expect(result.opponents[0].b.decisiveGames).toBe(1);
  });
  it("represents empty results as absent and excludes legacy non-win/loss records from the denominator", () => {
    const result = buildDeckComparison([match({ result: "draw" })], "a", "b");
    expect(result.sides[0].summary).toMatchObject({
      totalGames: 1,
      decisiveGames: 0,
      winRate: null,
      lossRate: null,
    });
    expect(result.sides[1].summary).toMatchObject({
      totalGames: 0,
      winRate: null,
      lossRate: null,
    });
    expect(
      result.sides[1].byOrder.every(
        (r) => r.winRate === null && r.lossRate === null,
      ),
    ).toBe(true);
    expect(buildDeckComparison([], "a", "b").months).toEqual([]);
  });
  it("rejects identical decks, malformed or repeated parameters, impossible and reversed dates", () => {
    expect(() => buildDeckComparison([], "a", "a")).toThrow("distintos");
    for (const q of [
      { from: "2026-02-30" },
      { from: "2026-02-01", to: "2026-01-01" },
      { format: ["standard"] },
      { from: ["2026-01-01"] },
    ])
      expect(comparisonFiltersSchema.safeParse(q).success).toBe(false);
    expect(comparisonIdsSchema.safeParse({ a: "not-a-uuid" }).success).toBe(
      false,
    );
    expect(
      comparisonIdsSchema.safeParse({ a: [syntheticCard(1).id] }).success,
    ).toBe(false);
    expect(
      comparisonFiltersSchema.parse({ format: "", from: "", to: "" }),
    ).toEqual({ format: undefined, from: undefined, to: undefined });
    expect(() => buildDeckComparison([], "a", "b", { from: "bad" })).toThrow();
  });
});

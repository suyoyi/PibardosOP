import { describe, it, expect } from "vitest";
import {
  buildAnalytics,
  tournamentSummary,
  type AnalyticsMatch,
} from "../../src/domain/statistics";
const match = (overrides: Partial<AnalyticsMatch> = {}): AnalyticsMatch => ({
  result: "win",
  deck_id: "deck-a",
  deck_version_id: "version-1",
  opponent_leader_id: "leader-a",
  went_first: true,
  played_at: "2026-01-01T12:00:00Z",
  ...overrides,
});
describe("honest competitive analytics", () => {
  it("uses a separate win/loss denominator for each play order", () => {
    const a = buildAnalytics([
      match({ went_first: false, result: "win" }),
      match({ went_first: false, result: "loss" }),
      match({ went_first: false, result: "loss" }),
      match(),
      match(),
      match(),
      match({ result: "loss" }),
    ]);
    expect(a.byOrder[0]).toMatchObject({
      label: "Primero",
      wins: 3,
      losses: 1,
      decisiveGames: 4,
      winRate: 0.75,
      lossRate: 0.25,
    });
    expect(a.byOrder[1]).toMatchObject({
      label: "Segundo",
      wins: 1,
      losses: 2,
      decisiveGames: 3,
      winRate: 1 / 3,
      lossRate: 2 / 3,
    });
  });
  it("keeps both orders visible without inventing percentages for absent games", () => {
    const empty = buildAnalytics([]).byOrder;
    expect(empty.map((r) => r.label)).toEqual(["Primero", "Segundo"]);
    for (const row of empty)
      expect(row).toMatchObject({
        totalGames: 0,
        decisiveGames: 0,
        winRate: null,
        lossRate: null,
      });
    const oneOrder = buildAnalytics([match()]).byOrder;
    expect(oneOrder[0]).toMatchObject({ winRate: 1, lossRate: 0 });
    expect(oneOrder[1]).toMatchObject({ winRate: null, lossRate: null });
  });
  it("excludes unsupported historical records from both order percentages", () => {
    const rows = buildAnalytics([
      match({ result: "draw" }),
      match({ result: "loss" }),
      match({ result: "draw", went_first: false }),
    ]).byOrder;
    expect(rows[0]).toMatchObject({
      totalGames: 2,
      decisiveGames: 1,
      winRate: 0,
      lossRate: 1,
    });
    expect(rows[1]).toMatchObject({
      totalGames: 1,
      decisiveGames: 0,
      winRate: null,
      lossRate: null,
    });
  });
  it("handles no games or only draws without a percentage", () => {
    expect(buildAnalytics([]).summary.winRate).toBe(null);
    expect(buildAnalytics([match({ result: "draw" })]).summary).toMatchObject({
      totalGames: 1,
      decisiveGames: 0,
      winRate: null,
      draws: 1,
    });
  });
  it("computes real records by exact version, opponent and play order", () => {
    const a = buildAnalytics([
      match(),
      match({
        result: "loss",
        went_first: false,
        deck_version_id: "version-2",
      }),
      match({ result: "draw", opponent_leader_id: "leader-b" }),
    ]);
    expect(a.summary).toMatchObject({
      wins: 1,
      losses: 1,
      draws: 1,
      totalGames: 3,
      decisiveGames: 2,
      winRate: 0.5,
    });
    expect(a.byVersion.map((v) => [v.label, v.totalGames])).toEqual([
      ["version-1", 2],
      ["version-2", 1],
    ]);
    expect(a.byOrder.find((g) => g.label === "Primero")).toMatchObject({
      wins: 1,
      draws: 1,
      decisiveGames: 1,
      winRate: 1,
    });
    expect(a.byOpponent.find((g) => g.label === "leader-b")?.winRate).toBe(
      null,
    );
  });
  it("shows eligible samples ahead of one-game perfect records", () => {
    const a = buildAnalytics([
      match({ deck_id: "tiny" }),
      ...Array.from({ length: 5 }, (_, i) =>
        match({ result: i === 0 ? "win" : "loss" }),
      ),
    ]);
    expect(a.byDeck[0]).toMatchObject({
      label: "deck-a",
      sufficientSample: true,
      winRate: 0.2,
    });
    expect(a.byDeck[1]).toMatchObject({
      label: "tiny",
      sufficientSample: false,
      winRate: 1,
    });
  });
  it("buckets months in Madrid and orders them chronologically", () => {
    const a = buildAnalytics([
      match({ played_at: "2026-02-01T00:00:00Z" }),
      match({ played_at: "2025-12-31T23:30:00Z" }),
      match({ played_at: "2025-12-01T00:00:00Z" }),
    ]);
    expect(a.byMonth.map((r) => r.label)).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });
  it("summarizes actual tournament results and gaps without invented rounds", () => {
    const s = tournamentSummary(
      [{ result: "win" }, { result: "draw" }],
      [
        { match_id: "a", round_number: 1 },
        { match_id: "b", round_number: 3 },
      ],
    );
    expect(s).toMatchObject({
      wins: 1,
      draws: 1,
      losses: 0,
      winRate: 1,
      totalGames: 2,
      decisiveGames: 1,
      recordedRounds: 2,
      highestRound: 3,
    });
    expect(tournamentSummary([], []).highestRound).toBe(0);
  });
});

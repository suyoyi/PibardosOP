import { describe, expect, it } from "vitest";
import { summarizeResults, summarizeCounts } from "../../src/domain/statistics";
describe("result convention", () => {
  it("returns no percentage for zero games", () =>
    expect(summarizeResults([])).toEqual({
      wins: 0,
      losses: 0,
      draws: 0,
      totalGames: 0,
      decisiveGames: 0,
      winRate: null,
    }));
  it("excludes draws from the win-rate denominator but preserves sample counts", () =>
    expect(summarizeResults(["win", "loss", "draw", "win"])).toEqual({
      wins: 2,
      losses: 1,
      draws: 1,
      totalGames: 4,
      decisiveGames: 3,
      winRate: 2 / 3,
    }));
  it("does not divide by zero for draw-only games", () =>
    expect(summarizeResults(["draw", "draw"]).winRate).toBeNull());
  it("aggregates database counts without truncating at the API row limit", () =>
    expect(summarizeCounts(1200, 600, 200)).toEqual({
      wins: 1200,
      losses: 600,
      draws: 200,
      totalGames: 2000,
      decisiveGames: 1800,
      winRate: 2 / 3,
    }));
  it("rejects invalid counts", () =>
    expect(() => summarizeCounts(-1, 0, 0)).toThrow());
});

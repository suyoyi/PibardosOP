import { describe, expect, it } from "vitest";
import { buildDashboard } from "../../src/domain/dashboard";
import type { Deck, DeckVersion } from "../../src/domain/decks";
import type { Database } from "../../src/lib/supabase/database.types";
import { syntheticCard } from "../fixtures/cards";

type Match = Database["public"]["Tables"]["matches"]["Row"];
const a = syntheticCard(1, { card_type: "leader" });
const alternate = syntheticCard(2, {
  card_type: "leader",
  card_number: a.card_number,
  canonical_card_id: a.id,
});
const b = syntheticCard(3, { card_type: "leader" });
const free = syntheticCard(4, { cost: 0 });
const expensive = syntheticCard(5, { cost: 10 });
const unknown = syntheticCard(6, { cost: null });
const don = syntheticCard(7, { card_type: "don", cost: null });
const catalog = [a, alternate, b, free, expensive, unknown, don];
function version(
  id: string,
  deck_id: string,
  leader_card_id: string,
  version_number = 1,
): DeckVersion {
  return {
    id,
    deck_id,
    leader_card_id,
    version_number,
    format: "standard",
    user_id: "owner",
    notes: "",
    change_summary: {},
    created_at: "2026-01-01T00:00:00Z",
  };
}
function deck(
  id: string,
  leader_card_id: string,
  current_version_id: string,
  status: Deck["status"] = "draft",
): Deck {
  return {
    id,
    leader_card_id,
    current_version_id,
    status,
    name: id,
    user_id: "owner",
    description: "",
    tags: [],
    format: "standard",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}
function game(
  id: string,
  deck_version_id: string,
  result: Match["result"],
  played_at = "2026-10-01T12:00:00Z",
): Match {
  return {
    id,
    deck_version_id,
    result,
    played_at,
    user_id: "owner",
    opponent_leader_id: b.id,
    went_first: result === "win",
    format: "standard",
    match_type: "casual",
    opponent_name: null,
    tournament_id: null,
    notes: "",
    created_at: played_at,
    updated_at: played_at,
  };
}
const workspace = {
  catalog,
  decks: [
    deck("original", a.id, "a2"),
    deck("alternate", alternate.id, "alt"),
    deck("changed", b.id, "b2"),
    deck("archive", a.id, "arch", "archived"),
  ],
  versions: [
    version("a1", "original", a.id),
    version("a2", "original", a.id, 2),
    version("alt", "alternate", alternate.id),
    version("b1", "changed", a.id),
    version("b2", "changed", b.id, 2),
    version("arch", "archive", a.id),
  ],
  entries: [
    {
      deck_version_id: "a1",
      card_id: free.id,
      quantity: 4,
      role: "main" as const,
    },
    {
      deck_version_id: "a2",
      card_id: free.id,
      quantity: 2,
      role: "main" as const,
    },
    {
      deck_version_id: "a2",
      card_id: expensive.id,
      quantity: 4,
      role: "main" as const,
    },
    {
      deck_version_id: "a2",
      card_id: unknown.id,
      quantity: 3,
      role: "main" as const,
    },
    {
      deck_version_id: "a2",
      card_id: don.id,
      quantity: 10,
      role: "don" as const,
    },
  ],
  matches: [
    game("win", "a1", "win"),
    game("loss", "alt", "loss"),
    game("old-leader", "b1", "win"),
    game("current-leader", "b2", "draw"),
    game("archived-game", "arch", "loss"),
  ],
};
describe("home dashboard snapshot semantics", () => {
  it("groups alternate leaders once and includes legacy archived decks without exposing statuses", () => {
    const data = buildDashboard(workspace);
    expect(data.deckCount).toBe(4);
    expect(data.leaders).toHaveLength(2);
    expect(
      data.leaders
        .find((group) => group.card.id === a.id)
        ?.decks.map((item) => item.id),
    ).toEqual(["original", "alternate", "archive"]);
    expect(data.overall.totalGames).toBe(5);
  });
  it("attributes past games to the actual played leader and preserves archived history", () => {
    const data = buildDashboard(workspace);
    const group = data.leaders.find((item) => item.card.id === a.id)!;
    expect(group.summary).toMatchObject({
      wins: 2,
      losses: 2,
      draws: 0,
      totalGames: 4,
      decisiveGames: 4,
      winRate: 0.5,
    });
    expect(group.recent.map((item) => item.id)).toContain("old-leader");
    expect(group.recent.map((item) => item.id)).toContain("archived-game");
    const other = data.leaders.find((item) => item.card.id === b.id)!;
    expect(other.summary).toMatchObject({
      wins: 0,
      losses: 0,
      draws: 1,
      totalGames: 1,
      decisiveGames: 0,
      winRate: null,
    });
  });
  it("weights current-version costs by copies, preserves zero/unknown and separates DON", () => {
    const current = buildDashboard(workspace).leaders[0].decks[0];
    expect(current.versionNumber).toBe(2);
    expect(current.mainCount).toBe(9);
    expect(current.donCount).toBe(10);
    expect(current.curve).toEqual([
      { cost: "0", quantity: 2 },
      { cost: "10", quantity: 4 },
      { cost: "Sin dato", quantity: 3 },
    ]);
  });
  it("orders recent games by played time and limits only the preview, never aggregate samples", () => {
    const matches = Array.from({ length: 12 }, (_, i) =>
      game(
        String(i),
        "a1",
        "win",
        `2026-10-${String(i + 1).padStart(2, "0")}T12:00:00Z`,
      ),
    );
    const data = buildDashboard({ ...workspace, matches });
    expect(data.overall.totalGames).toBe(12);
    expect(data.recent.map((item) => item.id)).toEqual([
      "11",
      "10",
      "9",
      "8",
      "7",
      "6",
    ]);
    expect(data.leaders[0].summary.totalGames).toBe(12);
  });
  it("handles empty workspaces, empty drafts and missing opponents without invented data", () => {
    expect(
      buildDashboard({
        catalog: [],
        decks: [],
        versions: [],
        entries: [],
        matches: [],
      }),
    ).toMatchObject({
      deckCount: 0,
      leaders: [],
      recent: [],
      overall: { totalGames: 0, winRate: null },
    });
    const data = buildDashboard({
      ...workspace,
      entries: [],
      matches: [
        {
          ...game("unknown-rival", "a1", "win"),
          opponent_leader_id: "missing",
        },
      ],
    });
    expect(data.leaders[0].decks[0].curve).toEqual([]);
    expect(data.leaders[0].decks[0].mainCount).toBe(0);
    expect(data.recent[0].opponent).toBe("Líder no disponible");
  });
  it("uses Madrid month boundaries and exposes real first/second sample sizes", () => {
    const data = buildDashboard({
      ...workspace,
      matches: [
        game("month", "a1", "win", "2026-03-31T22:30:00Z"),
        game("second", "a1", "loss", "2026-04-01T12:00:00Z"),
      ],
    });
    expect(data.leaders[0].byMonth).toMatchObject([
      { label: "2026-04", wins: 1, losses: 1, decisiveGames: 2 },
    ]);
    expect(data.leaders[0].byOrder).toMatchObject([
      { label: "Primero", decisiveGames: 1, wins: 1 },
      { label: "Segundo", decisiveGames: 1, losses: 1 },
    ]);
  });
});

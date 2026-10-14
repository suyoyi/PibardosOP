import type { Database } from "@/lib/supabase/database.types";
import { canonicalGroups, type Card } from "./cards";
import { costCurve, type Deck, type DeckVersion } from "./decks";
import { buildAnalytics } from "./statistics";

type Match = Database["public"]["Tables"]["matches"]["Row"];
type Entry = Database["public"]["Tables"]["deck_cards"]["Row"];
type Workspace = {
  catalog: readonly Card[];
  decks: readonly Deck[];
  versions: readonly DeckVersion[];
  entries: readonly Entry[];
  matches: readonly Match[];
};

export function buildDashboard(workspace: Workspace) {
  const { catalog, decks, versions, entries, matches } = workspace;
  const cards = new Map(catalog.map((card) => [card.id, card]));
  const snapshots = new Map(versions.map((version) => [version.id, version]));
  const deckNames = new Map(decks.map((deck) => [deck.id, deck.name]));
  const identities = canonicalGroups(catalog);
  const identity = (id: string) => identities.get(id) ?? id;
  const records = matches.map((match) => ({
    ...match,
    deck_id: snapshots.get(match.deck_version_id)?.deck_id ?? "",
  }));
  const activeDecks = decks.filter((deck) => deck.status !== "archived");
  const leaders = new Map<string, Card>();
  for (const deck of activeDecks) {
    const snapshot = snapshots.get(deck.current_version_id ?? "");
    const leader = cards.get(snapshot?.leader_card_id ?? deck.leader_card_id);
    if (leader && !leaders.has(identity(leader.id)))
      leaders.set(identity(leader.id), leader);
  }
  const recent = (games: typeof records) =>
    [...games]
      .sort(
        (a, b) =>
          b.played_at.localeCompare(a.played_at) || a.id.localeCompare(b.id),
      )
      .slice(0, 6)
      .map((game) => {
        const version = snapshots.get(game.deck_version_id);
        const opponent = cards.get(game.opponent_leader_id);
        return {
          id: game.id,
          result: game.result,
          wentFirst: game.went_first,
          playedAt: game.played_at,
          deckName: deckNames.get(game.deck_id) ?? "Mazo no disponible",
          versionNumber: version?.version_number ?? null,
          opponent: opponent
            ? `${opponent.card_number} · ${opponent.name}`
            : "Líder no disponible",
        };
      });
  return {
    activeDeckCount: activeDecks.length,
    overall: buildAnalytics(records).summary,
    recent: recent(records),
    leaders: [...leaders].map(([id, card]) => {
      // Match identity comes from the immutable snapshot, never the current deck.
      const games = records.filter((game) => {
        const version = snapshots.get(game.deck_version_id);
        return version && identity(version.leader_card_id) === id;
      });
      const analytics = buildAnalytics(games);
      return {
        id,
        card,
        summary: analytics.summary,
        byMonth: analytics.byMonth,
        byOrder: analytics.byOrder,
        recent: recent(games),
        decks: activeDecks
          .filter((deck) => {
            const version = snapshots.get(deck.current_version_id ?? "");
            return (
              identity(version?.leader_card_id ?? deck.leader_card_id) === id
            );
          })
          .map((deck) => {
            const version = snapshots.get(deck.current_version_id ?? "");
            const list = entries.filter(
              (entry) => entry.deck_version_id === version?.id,
            );
            return {
              id: deck.id,
              name: deck.name,
              status: deck.status,
              format: version?.format ?? deck.format,
              versionId: version?.id ?? null,
              versionNumber: version?.version_number ?? null,
              leader:
                cards.get(version?.leader_card_id ?? deck.leader_card_id) ??
                card,
              mainCount: list
                .filter((entry) => entry.role === "main")
                .reduce((sum, entry) => sum + entry.quantity, 0),
              donCount: list
                .filter((entry) => entry.role === "don")
                .reduce((sum, entry) => sum + entry.quantity, 0),
              curve: costCurve(list, catalog).sort((a, b) =>
                a.cost === "Sin dato"
                  ? 1
                  : b.cost === "Sin dato"
                    ? -1
                    : Number(a.cost) - Number(b.cost),
              ),
            };
          }),
      };
    }),
  };
}
export type DashboardData = ReturnType<typeof buildDashboard>;
export type DashboardLeader = DashboardData["leaders"][number];

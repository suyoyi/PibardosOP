export type MatchResult = "win" | "loss" | "draw";
export function summarizeCounts(wins: number, losses: number, draws: number) {
  if (
    [wins, losses, draws].some(
      (count) => !Number.isSafeInteger(count) || count < 0,
    )
  )
    throw new Error("Match counts must be non-negative integers.");
  const decisiveGames = wins + losses;
  return {
    wins,
    losses,
    draws,
    totalGames: decisiveGames + draws,
    decisiveGames,
    winRate: decisiveGames ? wins / decisiveGames : null,
  };
}
export function summarizeResults(results: readonly MatchResult[]) {
  const wins = results.filter((result) => result === "win").length;
  const losses = results.filter((result) => result === "loss").length;
  const draws = results.length - wins - losses;
  return summarizeCounts(wins, losses, draws);
}
export type AnalyticsMatch = {
  result: MatchResult;
  deck_id: string;
  deck_version_id: string;
  opponent_leader_id: string;
  went_first: boolean;
  played_at: string;
};
export function groupedResults(
  matches: readonly AnalyticsMatch[],
  key: (match: AnalyticsMatch) => string,
) {
  const groups = new Map<string, MatchResult[]>();
  for (const match of matches) {
    const label = key(match);
    const values = groups.get(label) ?? [];
    values.push(match.result);
    groups.set(label, values);
  }
  return [...groups].map(([label, results]) => ({
    label,
    ...summarizeResults(results),
  }));
}
export function buildAnalytics(
  matches: readonly AnalyticsMatch[],
  minimumDecisiveGames = 5,
) {
  const summary = summarizeResults(matches.map((m) => m.result));
  const byDeck = groupedResults(matches, (m) => m.deck_id)
    .map((group) => ({
      ...group,
      sufficientSample: group.decisiveGames >= minimumDecisiveGames,
    }))
    .sort(
      (a, b) =>
        Number(b.sufficientSample) - Number(a.sufficientSample) ||
        (b.winRate ?? -1) - (a.winRate ?? -1) ||
        b.totalGames - a.totalGames,
    );
  const monthKey = (date: string) => {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: "Europe/Madrid",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(new Date(date));
    return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}`;
  };
  const byOrder = [true, false].map((wentFirst) => {
    const record = summarizeResults(
      matches.filter((m) => m.went_first === wentFirst).map((m) => m.result),
    );
    return {
      label: wentFirst ? "Primero" : "Segundo",
      ...record,
      lossRate: record.decisiveGames
        ? record.losses / record.decisiveGames
        : null,
    };
  });
  return {
    summary,
    byDeck,
    byVersion: groupedResults(matches, (m) => m.deck_version_id),
    byOpponent: groupedResults(matches, (m) => m.opponent_leader_id),
    byOrder,
    byMonth: groupedResults(matches, (m) => monthKey(m.played_at)).sort(
      (a, b) => a.label.localeCompare(b.label),
    ),
    minimumDecisiveGames,
  };
}
export function tournamentSummary(
  matches: readonly { result: MatchResult }[],
  rounds: readonly { match_id: string; round_number: number }[],
) {
  return {
    ...summarizeResults(matches.map((m) => m.result)),
    recordedRounds: rounds.length,
    highestRound: rounds.length
      ? Math.max(...rounds.map((r) => r.round_number))
      : 0,
  };
}

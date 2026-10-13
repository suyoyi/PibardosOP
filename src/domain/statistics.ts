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

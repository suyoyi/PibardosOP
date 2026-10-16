import { z } from "zod";
import { canonicalGroups, type Card } from "./cards";
import {
  buildAnalytics,
  summarizeCounts,
  type AnalyticsMatch,
} from "./statistics";
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());
export const comparisonIdsSchema = z.object({
  a: optional(z.uuid()),
  b: optional(z.uuid()),
});
export const comparisonFiltersSchema = z
  .object({
    format: optional(z.string().trim().max(60)),
    from: optional(z.iso.date()),
    to: optional(z.iso.date()),
  })
  .refine(
    (f) => !f.from || !f.to || f.from <= f.to,
    "La fecha inicial no puede ser posterior a la final.",
  );
export type ComparisonFilters = z.infer<typeof comparisonFiltersSchema>;
const madridDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Madrid",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function dayKey(value: string) {
  const p = madridDate.formatToParts(new Date(value));
  return `${p.find((v) => v.type === "year")!.value}-${p.find((v) => v.type === "month")!.value}-${p.find((v) => v.type === "day")!.value}`;
}
export type ComparisonMatch = AnalyticsMatch & { format: string };
export function buildDeckComparison(
  matches: readonly ComparisonMatch[],
  aId: string,
  bId: string,
  input: ComparisonFilters = {},
  catalog: readonly Card[] = [],
) {
  if (!aId || !bId || aId === bId)
    throw new Error("Selecciona dos mazos distintos.");
  const filters = comparisonFiltersSchema.parse(input),
    identities = canonicalGroups(
      catalog.filter((c) => c.card_type === "leader"),
    );
  const records = matches
    .filter((m) => {
      if (m.deck_id !== aId && m.deck_id !== bId) return false;
      if (filters.format && m.format !== filters.format) return false;
      const day = filters.from || filters.to ? dayKey(m.played_at) : "";
      return (
        (!filters.from || day >= filters.from) &&
        (!filters.to || day <= filters.to)
      );
    })
    .map((m) => ({
      ...m,
      opponent_leader_id:
        identities.get(m.opponent_leader_id) ?? m.opponent_leader_id,
    }));
  const sides = [aId, bId].map((id) => {
    const analytics = buildAnalytics(records.filter((m) => m.deck_id === id)),
      s = analytics.summary;
    return {
      id,
      ...analytics,
      summary: {
        ...s,
        lossRate: s.decisiveGames ? s.losses / s.decisiveGames : null,
      },
    };
  });
  function align(key: "byMonth" | "byOpponent") {
    const [a, b] = sides.map((s) => new Map(s[key].map((r) => [r.label, r])));
    return [...new Set([...a.keys(), ...b.keys()])].sort().map((label) => ({
      label,
      a: a.get(label) ?? summarizeCounts(0, 0, 0),
      b: b.get(label) ?? summarizeCounts(0, 0, 0),
    }));
  }
  return {
    sides,
    opponents: align("byOpponent"),
    months: align("byMonth"),
    filters,
  };
}
export type DeckComparison = ReturnType<typeof buildDeckComparison>;

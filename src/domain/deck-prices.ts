import { z } from "zod";
import type { Card } from "./cards";
import type { DeckEntry } from "./deck-import";
import type { Database } from "@/lib/supabase/database.types";

export type SavedDeckQuote = Pick<
  Database["public"]["Tables"]["optcg_card_items"]["Row"],
  "card_id" | "external_id" | "prices" | "fetched_at" | "source_date"
>;
const pricesSchema = z
  .array(
    z.object({
      metric: z.enum(["market_price", "inventory_price"]),
      amount: z.number().finite().min(0).max(1e10),
      currency: z.null(),
    }),
  )
  .max(2);

// Work with the decimal representation of source numbers, then serialize strings.
// This avoids binary floating-point errors when multiplying and summing prices.
function decimal(amount: number) {
  const [mantissa, exponent = "0"] = String(amount).split("e"),
    [whole, fraction = ""] = mantissa.split("."),
    scale = fraction.length - Number(exponent);
  return scale < 0
    ? { units: BigInt(whole + fraction) * 10n ** BigInt(-scale), scale: 0 }
    : { units: BigInt(whole + fraction), scale };
}
function decimalText(units: bigint, scale: number) {
  const digits = units.toString().padStart(scale + 1, "0");
  return scale
    ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.?0+$/, "")
    : digits;
}
function sum(values: readonly string[]) {
  const parts = values.map((s) => {
    const [whole, fraction = ""] = s.split(".");
    return { units: BigInt(whole + fraction), scale: fraction.length };
  });
  const scale = Math.max(0, ...parts.map((p) => p.scale));
  return decimalText(
    parts.reduce((n, p) => n + p.units * 10n ** BigInt(scale - p.scale), 0n),
    scale,
  );
}
export function formatDeckAmount(amount: string | null) {
  if (amount === null) return "Sin precio";
  const [whole, fraction = ""] = amount.split(".");
  return `${BigInt(whole).toLocaleString("es-ES")},${fraction.padEnd(2, "0")}`;
}
export function buildDeckDisplay(
  leaderId: string,
  entries: readonly DeckEntry[],
  catalog: readonly Card[],
  quotes: readonly SavedDeckQuote[],
) {
  const requirements = [
    { card_id: leaderId, quantity: 1, role: "leader" as const },
    ...entries,
  ];
  const rows = requirements
    .map((entry) => {
      const card = catalog.find((c) => c.id === entry.card_id);
      if (!card) throw new Error("No se pudo recuperar una carta del mazo.");
      const matches = quotes.filter(
        (q) =>
          card.source === "optcgapi" &&
          q.card_id === card.id &&
          q.external_id === card.provider_card_id,
      );
      const candidate = matches.length === 1 ? matches[0] : null,
        parsed = pricesSchema.safeParse(candidate?.prices),
        markets = parsed.success
          ? parsed.data.filter((q) => q.metric === "market_price")
          : [],
        quote =
          parsed.success &&
          new Set(parsed.data.map((q) => q.metric)).size === parsed.data.length
            ? candidate
            : null,
        price =
          quote && markets.length === 1 ? decimal(markets[0].amount) : null;
      return {
        card,
        quantity: entry.quantity,
        role: entry.role,
        quote,
        unitPrice: price ? decimalText(price.units, price.scale) : null,
        lineTotal: price
          ? decimalText(price.units * BigInt(entry.quantity), price.scale)
          : null,
      };
    })
    .sort((a, b) => {
      const order = { leader: 0, main: 1, don: 2 };
      return (
        order[a.role] - order[b.role] ||
        (a.card.cost ?? Infinity) - (b.card.cost ?? Infinity) ||
        a.card.card_number.localeCompare(b.card.card_number) ||
        a.card.printing_code.localeCompare(b.card.printing_code) ||
        a.card.id.localeCompare(b.card.id)
      );
    });
  function summary(selected: typeof rows) {
    const known = selected.filter((r) => r.lineTotal !== null),
      copies = selected.reduce((n, r) => n + r.quantity, 0),
      pricedCopies = known.reduce((n, r) => n + r.quantity, 0);
    return {
      copies,
      pricedCopies,
      printings: selected.length,
      pricedPrintings: known.length,
      complete: pricedCopies === copies,
      amount:
        known.length || !copies ? sum(known.map((r) => r.lineTotal!)) : null,
      oldestFetchedAt:
        known
          .map((r) => r.quote!.fetched_at)
          .sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null,
    };
  }
  return {
    rows,
    total: summary(rows),
    groups: (["leader", "main", "don"] as const).map((role) => ({
      role,
      ...summary(rows.filter((r) => r.role === role)),
    })),
  };
}
export type DeckDisplay = ReturnType<typeof buildDeckDisplay>;

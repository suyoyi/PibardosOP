import { z } from "zod";
import { normalizeCardNumber } from "./cards";
import type { OptcgFamily } from "./optcg";

export type PriceHistorySelection = {
  card_number: string;
  external_id: string;
  family: OptcgFamily;
};
export type PriceHistoryPoint = {
  slot: string;
  market: number | null;
  inventory: number | null;
};
export type PriceHistory = {
  status: "available" | "empty" | "unavailable";
  points: PriceHistoryPoint[];
  sourceDate: string | null;
  issues: string[];
  message?: string;
};
export function historySelection(
  cardNumber: string,
  externalId: string | null,
): PriceHistorySelection | null {
  const match = externalId?.match(
    /^optcg_(sets|decks|promos|don)_[A-Za-z0-9_-]{1,200}$/,
  );
  return match
    ? {
        card_number: cardNumber,
        external_id: externalId!,
        family: match[1] as OptcgFamily,
      }
    : null;
}

export function normalizePriceHistory(
  raw: unknown,
  selection: PriceHistorySelection,
): PriceHistory {
  const rows = z.array(z.unknown()).max(10000).parse(raw);
  const matches = rows.filter((value): value is Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return false;
    const row = value as Record<string, unknown>;
    return (
      typeof row.card_set_id === "string" &&
      normalizeCardNumber(row.card_set_id) === selection.card_number &&
      typeof row.card_image_id === "string" &&
      `optcg_${selection.family}_${row.card_image_id}` === selection.external_id
    );
  });
  if (matches.length !== 1)
    return {
      status: "unavailable",
      points: [],
      sourceDate: null,
      issues: [],
      message: matches.length
        ? "El proveedor devuelve varias series para esta misma impresión. No se mezclan sus precios."
        : "No hay histórico para esta impresión exacta. No se sustituye por el de otro arte.",
    };
  const row = matches[0],
    issues: string[] = [];
  function amount(key: string) {
    const value = row[key];
    if (value == null || value === "NULL" || value === "") return null;
    const parsed = z.number().finite().min(0).max(1e10).safeParse(value);
    if (parsed.success) return parsed.data;
    issues.push(`${key}: precio no válido; se conserva como dato ausente.`);
    return null;
  }
  // DayN dates and chronological direction are not documented. Preserve the
  // field order without assigning calendar dates or claiming a trend/change.
  const points = Array.from({ length: 13 }, (_, index) => ({
    slot: `Day${index + 1}`,
    market: amount(`Day${index + 1}_Market_Price`),
    inventory: amount(`Day${index + 1}_Inventory_Price`),
  }));
  const hasHistory = points.some(
    (p) => p.market !== null || p.inventory !== null,
  );
  points.push({
    slot: "Última",
    market: amount("market_price"),
    inventory: amount("inventory_price"),
  });
  const date = z.iso.date().safeParse(row.date_scraped);
  if (row.date_scraped != null && !date.success)
    issues.push("La fecha de referencia del proveedor no es válida.");
  return {
    status: hasHistory ? "available" : "empty",
    points,
    issues,
    sourceDate: date.success ? date.data : null,
    ...(!hasHistory
      ? {
          message:
            "El proveedor no incluye puntos históricos para esta impresión. La última cotización se muestra por separado.",
        }
      : {}),
  };
}

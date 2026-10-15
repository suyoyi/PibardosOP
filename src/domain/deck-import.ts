import { normalizeCardNumber, cardNumberPattern, type Card } from "./cards";

export type DeckEntry = {
  card_id: string;
  quantity: number;
  role: "main" | "don";
};
export type ImportEntry = { card: Card; quantity: number; lines: number[] };
export type ImportProblem = {
  line: number;
  raw: string;
  code: string;
  card_number?: string;
  message: string;
};
export type ImportReport = {
  entries: ImportEntry[];
  unknown: ImportProblem[];
  malformed: ImportProblem[];
  duplicates: { card_number: string; lines: number[]; quantity: number }[];
};
export function normalizeDeckText(raw: string) {
  return raw.replace(/\r\n?/g, "\n");
}
type ParsedLine = { quantity: number; cardNumber: string };
// Syntax handlers may be extended without changing the deck model.
const syntaxes: ((line: string) => ParsedLine | null)[] = [
  (line) => {
    const m =
      line.match(/^(\d+)\s*[x×]?\s+([^\s]+)$/i) ??
      line.match(/^(\d+)[x×]([^\s]+)$/i);
    return m ? { quantity: Number(m[1]), cardNumber: m[2] } : null;
  },
  (line) => {
    const m =
      line.match(/^([^\s]+)\s+[x×]?\s*(\d+)$/i) ??
      line.match(/^([^\s]+?)[x×](\d+)$/i);
    return m ? { quantity: Number(m[2]), cardNumber: m[1] } : null;
  },
  (line) =>
    cardNumberPattern.test(normalizeCardNumber(line))
      ? { quantity: 1, cardNumber: line }
      : null,
];
export function parseDecklist(
  raw: string,
  catalog: readonly Card[],
): ImportReport {
  const report: ImportReport = {
    entries: [],
    unknown: [],
    malformed: [],
    duplicates: [],
  };
  if (raw.length > 100000) {
    report.malformed.push({
      line: 0,
      raw: "",
      code: "INPUT_LIMIT",
      message: "La lista supera los 100.000 caracteres.",
    });
    return report;
  }
  const byNumber = new Map<string, Card>();
  // Canonical roots define copy identity, not necessarily the base artwork.
  // Prefer an explicitly identified OPTCG base, then a root, with stable ties.
  const priority = (card: Card) =>
    card.source === "optcgapi" && card.printing_code === card.card_number
      ? 2
      : card.id === card.canonical_card_id
        ? 1
        : 0;
  for (const card of [...catalog].sort((a, b) => a.id.localeCompare(b.id))) {
    const key = normalizeCardNumber(card.card_number),
      current = byNumber.get(key);
    if (!current || priority(card) > priority(current)) byNumber.set(key, card);
  }
  const aggregated = new Map<string, ImportEntry>();
  normalizeDeckText(raw)
    .split("\n")
    .forEach((original, index) => {
      const line = original.normalize("NFKC").replace(/[–—−]/g, "-").trim();
      if (
        !line ||
        line.startsWith("#") ||
        /^(leader|líder|main(?: deck)?|mazo principal|don!!(?: deck)?):?$/i.test(
          line,
        )
      )
        return;
      const parsed = syntaxes.map((handler) => handler(line)).find(Boolean);
      const problem = {
        line: index + 1,
        raw: original,
        code: "MALFORMED",
        message: "Usa una cantidad entera y un código, por ejemplo 4 OP01-025.",
      };
      if (
        !parsed ||
        !cardNumberPattern.test(normalizeCardNumber(parsed.cardNumber)) ||
        !Number.isSafeInteger(parsed.quantity) ||
        parsed.quantity < 1 ||
        parsed.quantity > 50
      ) {
        report.malformed.push(problem);
        return;
      }
      const number = normalizeCardNumber(parsed.cardNumber),
        card = byNumber.get(number);
      if (!card) {
        report.unknown.push({
          ...problem,
          code: "UNKNOWN_CARD",
          card_number: number,
          message: `${number} no está en tu catálogo. Añádela manualmente o corrige el código.`,
        });
        return;
      }
      const entry = aggregated.get(card.id);
      if (entry) {
        entry.quantity += parsed.quantity;
        entry.lines.push(index + 1);
      } else
        aggregated.set(card.id, {
          card,
          quantity: parsed.quantity,
          lines: [index + 1],
        });
    });
  report.entries = [...aggregated.values()];
  report.duplicates = report.entries
    .filter((entry) => entry.lines.length > 1)
    .map((entry) => ({
      card_number: entry.card.card_number,
      lines: entry.lines,
      quantity: entry.quantity,
    }));
  return report;
}
export function importedMainEntries(report: ImportReport): DeckEntry[] {
  return report.entries
    .filter((entry) => entry.card.card_type !== "leader")
    .map((entry) => ({
      card_id: entry.card.id,
      quantity: entry.quantity,
      role: entry.card.card_type === "don" ? "don" : "main",
    }));
}
export function exportDecklist(
  leader: Card,
  entries: readonly DeckEntry[],
  catalog: readonly Card[],
) {
  const byId = new Map(catalog.map((card) => [card.id, card]));
  const lines = [`1 ${leader.card_number}`];
  for (const role of ["main", "don"] as const) {
    const counts = new Map<string, number>();
    for (const entry of entries.filter((e) => e.role === role)) {
      const card = byId.get(entry.card_id);
      if (!card) throw new Error("Cannot export an unknown card.");
      counts.set(
        card.card_number,
        (counts.get(card.card_number) ?? 0) + entry.quantity,
      );
    }
    for (const [code, quantity] of [...counts].sort(([a], [b]) =>
      a.localeCompare(b),
    ))
      lines.push(`${quantity} ${code}`);
  }
  return lines.join("\n");
}

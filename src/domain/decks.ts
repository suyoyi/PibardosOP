import type { Database } from "@/lib/supabase/database.types";
import { canonicalGroups, type Card } from "./cards";
import type { DeckEntry } from "./deck-import";
export type Deck = Database["public"]["Tables"]["decks"]["Row"];
export type DeckVersion = Database["public"]["Tables"]["deck_versions"]["Row"];
export type Restriction =
  Database["public"]["Tables"]["card_restrictions"]["Row"];
export type ValidationIssue = {
  severity: "error" | "warning";
  code: string;
  card_id?: string;
  message: string;
};
export type Ruleset = {
  mainSize: number;
  maxCopies: number;
  donSize: number;
  format: string;
  date: string;
  restrictionsVerified: boolean;
};
export const standardRules = (
  format = "standard",
  date = new Date().toISOString().slice(0, 10),
): Ruleset => ({
  mainSize: 50,
  maxCopies: 4,
  donSize: 10,
  format,
  date,
  restrictionsVerified: false,
});
export function validateDeck(
  leader: Card | undefined,
  entries: readonly DeckEntry[],
  catalog: readonly Card[],
  restrictions: readonly Restriction[] = [],
  rules = standardRules(),
) {
  const issues: ValidationIssue[] = [],
    byId = new Map(catalog.map((card) => [card.id, card]));
  const identities = canonicalGroups(catalog);
  const error = (code: string, message: string, card_id?: string) =>
    issues.push({
      severity: "error",
      code,
      message,
      ...(card_id ? { card_id } : {}),
    });
  if (!leader || leader.card_type !== "leader")
    error("LEADER", "Selecciona exactamente un líder.");
  const mainCount = entries
    .filter((entry) => entry.role === "main")
    .reduce((n, e) => n + e.quantity, 0);
  if (mainCount !== rules.mainSize)
    error(
      "MAIN_COUNT",
      `El mazo principal tiene ${mainCount} cartas; necesita ${rules.mainSize}.`,
    );
  const donCount = entries
    .filter((entry) => entry.role === "don")
    .reduce((n, e) => n + e.quantity, 0);
  if (donCount && donCount !== rules.donSize)
    error(
      "DON_COUNT",
      `El DON!! separado tiene ${donCount} cartas; necesita ${rules.donSize}.`,
    );
  const totals = new Map<string, { count: number; card: Card }>(),
    seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.card_id))
      error(
        "DUPLICATE_PRINTING",
        "Agrupa las cantidades de una misma impresión.",
        entry.card_id,
      );
    seen.add(entry.card_id);
    if (
      !Number.isInteger(entry.quantity) ||
      entry.quantity < 1 ||
      entry.quantity > 50
    )
      error(
        "QUANTITY",
        "La cantidad debe ser un entero entre 1 y 50.",
        entry.card_id,
      );
    const card = byId.get(entry.card_id);
    if (!card) {
      error(
        "UNKNOWN_CARD",
        "Una carta no está disponible en el catálogo.",
        entry.card_id,
      );
      continue;
    }
    if (entry.role === "don") {
      if (card.card_type !== "don")
        error("DON_TYPE", `${card.card_number} no es DON!!.`, card.id);
      continue;
    }
    if (!["character", "event", "stage"].includes(card.card_type))
      error(
        "MAIN_TYPE",
        `${card.card_number} no puede ir en el mazo principal.`,
        card.id,
      );
    if (!card.colors.length || !leader?.colors.length)
      issues.push({
        severity: "warning",
        code: "COLOR_UNVERIFIED",
        card_id: card.id,
        message: `${card.card_number}: faltan colores para comprobar la compatibilidad.`,
      });
    else if (!card.colors.some((color) => leader.colors.includes(color)))
      error(
        "COLOR",
        `${card.card_number} no comparte ningún color con el líder.`,
        card.id,
      );
    const identity = identities.get(card.id) ?? card.canonical_card_id;
    const current = totals.get(identity);
    totals.set(identity, {
      count: (current?.count ?? 0) + entry.quantity,
      card,
    });
  }
  for (const [canonical, { count, card }] of totals) {
    const effective = restrictions.filter(
      (r) =>
        (identities.get(r.canonical_card_id) ?? r.canonical_card_id) ===
          canonical &&
        r.format === rules.format &&
        r.verified_at &&
        r.effective_from <= rules.date &&
        (!r.effective_until || r.effective_until >= rules.date),
    );
    const max = Math.min(
      rules.maxCopies,
      ...effective.map((r) => r.maximum_quantity),
    );
    if (count > max)
      error(
        "COPY_LIMIT",
        `${card.card_number}: ${count} copias entre todas sus impresiones; máximo ${max}.`,
        card.id,
      );
  }
  if (
    leader &&
    restrictions.some(
      (r) =>
        (identities.get(r.canonical_card_id) ?? r.canonical_card_id) ===
          (identities.get(leader.id) ?? leader.canonical_card_id) &&
        r.format === rules.format &&
        r.restriction_type === "banned" &&
        r.verified_at &&
        r.effective_from <= rules.date &&
        (!r.effective_until || r.effective_until >= rules.date),
    )
  )
    error(
      "BANNED_LEADER",
      "El líder está prohibido en este formato y fecha.",
      leader.id,
    );
  if (!rules.restrictionsVerified)
    issues.push({
      severity: "warning",
      code: "LEGALITY_UNVERIFIED",
      message:
        "Legalidad de torneo sin verificar: no hay un listado completo de restricciones actuales verificado.",
    });
  return {
    mainCount,
    donCount,
    issues,
    validConstruction: !issues.some((issue) => issue.severity === "error"),
    constructionVerified: !issues.some(
      (issue) =>
        issue.severity === "error" || issue.code === "COLOR_UNVERIFIED",
    ),
    tournamentLegality:
      rules.restrictionsVerified && !issues.length ? "verified" : "unverified",
  };
}
export function compareEntries(
  before: readonly DeckEntry[],
  after: readonly DeckEntry[],
) {
  const a = new Map(before.map((e) => [e.card_id, e])),
    b = new Map(after.map((e) => [e.card_id, e]));
  return [...new Set([...a.keys(), ...b.keys()])]
    .map((card_id) => ({
      card_id,
      before: a.get(card_id)?.quantity ?? 0,
      after: b.get(card_id)?.quantity ?? 0,
      beforeRole: a.get(card_id)?.role,
      afterRole: b.get(card_id)?.role,
    }))
    .filter((e) => e.before !== e.after || e.beforeRole !== e.afterRole);
}
export function costCurve(
  entries: readonly DeckEntry[],
  catalog: readonly Card[],
) {
  const cards = new Map(catalog.map((c) => [c.id, c])),
    counts = new Map<string, number>();
  for (const entry of entries.filter((e) => e.role === "main")) {
    const cost = cards.get(entry.card_id)?.cost;
    const label = cost == null ? "Sin dato" : String(cost);
    counts.set(label, (counts.get(label) ?? 0) + entry.quantity);
  }
  return [...counts]
    .sort((a, b) => (Number(a[0]) || 0) - (Number(b[0]) || 0))
    .map(([cost, quantity]) => ({ cost, quantity }));
}

import {
  canonicalGroups,
  normalizeCardNumber,
  type Card,
  type CatalogFilterCard,
} from "./cards";
import type { DeckEntry } from "./deck-import";

type Candidate = Pick<
  CatalogFilterCard,
  "card_number" | "card_type" | "colors"
> &
  Partial<Pick<Card, "id" | "canonical_card_id">>;
export function compatibleWithLeader(
  card: Candidate,
  leader: Pick<Card, "colors"> | undefined,
) {
  return (
    card.card_type === "don" ||
    Boolean(
      leader?.colors.length &&
      card.colors.some((color) => leader.colors.includes(color)),
    )
  );
}
export function builderCopyCount(
  card: Candidate,
  entries: readonly DeckEntry[],
  catalog: readonly Card[],
) {
  const identities = canonicalGroups(catalog);
  const printed = catalog.find(
    (item) =>
      normalizeCardNumber(item.card_number) ===
      normalizeCardNumber(card.card_number),
  );
  const root =
    identities.get(card.id ?? printed?.id ?? "") ?? card.canonical_card_id;
  return entries
    .filter(
      (entry) => entry.role === (card.card_type === "don" ? "don" : "main"),
    )
    .reduce((sum, entry) => {
      const saved = catalog.find((item) => item.id === entry.card_id);
      return saved &&
        ((root && identities.get(saved.id) === root) ||
          normalizeCardNumber(saved.card_number) ===
            normalizeCardNumber(card.card_number))
        ? sum + entry.quantity
        : sum;
    }, 0);
}
export function builderMaximumQuantity(
  card: Candidate,
  entries: readonly DeckEntry[],
  catalog: readonly Card[],
) {
  const own = entries.find((entry) => entry.card_id === card.id)?.quantity ?? 0;
  const role = card.card_type === "don" ? "don" : "main";
  const total = entries
    .filter((entry) => entry.role === role)
    .reduce((sum, entry) => sum + entry.quantity, 0);
  return Math.max(
    0,
    Math.min(
      (role === "don" ? 10 : 4) -
        builderCopyCount(card, entries, catalog) +
        own,
      (role === "don" ? 10 : 50) - total + own,
    ),
  );
}

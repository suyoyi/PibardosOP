import type { Database } from "@/lib/supabase/database.types";

export type Card = Database["public"]["Tables"]["cards"]["Row"];
export type CardColor = Database["public"]["Enums"]["card_color"];
export const colorLabels: Record<CardColor, string> = {
  red: "Rojo",
  green: "Verde",
  blue: "Azul",
  purple: "Morado",
  black: "Negro",
  yellow: "Amarillo",
};
export const typeLabels: Record<Card["card_type"], string> = {
  leader: "Líder",
  character: "Personaje",
  event: "Evento",
  stage: "Escenario",
  don: "DON!!",
};
export type CardFilters = {
  search?: string;
  color?: string;
  type?: string;
  set?: string;
  cost?: string;
  power?: string;
  counter?: string;
  attribute?: string;
};
export type CatalogFilterCard = Pick<
  Card,
  | "card_number"
  | "name"
  | "colors"
  | "card_type"
  | "set_code"
  | "cost"
  | "power"
  | "counter"
  | "attribute"
>;
export function filterCards<T extends CatalogFilterCard>(
  cards: readonly T[],
  filters: CardFilters,
): T[] {
  const query = (filters.search ?? "").trim().toLocaleLowerCase("es");
  return cards.filter(
    (card) =>
      (!query ||
        `${card.card_number} ${card.name}`
          .toLocaleLowerCase("es")
          .includes(query)) &&
      (!filters.color || card.colors.includes(filters.color as CardColor)) &&
      (!filters.type || card.card_type === filters.type) &&
      (!filters.set || card.set_code === filters.set) &&
      (!filters.cost || card.cost === Number(filters.cost)) &&
      (!filters.power || card.power === Number(filters.power)) &&
      (!filters.counter || card.counter === Number(filters.counter)) &&
      (!filters.attribute || card.attribute === filters.attribute),
  );
}
export interface CardProvider {
  search(filters: CardFilters): Promise<Card[]>;
  getCard(id: string): Promise<Card | null>;
  synchronize(): Promise<{
    mode: "manual" | "dataset";
    imported: number;
    message: string;
  }>;
}
export function normalizeCardNumber(value: string) {
  return value
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, "")
    .trim();
}
export const cardNumberPattern =
  /^(?:(?:OP|ST|EB|PRB)\d{2,3}-\d{3}|P-\d{3}|DON!!)$/;

// Bridge manual and future shared catalogs by printed code while retaining
// canonical links for reprints carrying different printed numbers.
export function canonicalGroups(cards: readonly Card[]) {
  const parents = new Map<string, string>(),
    numbers = new Map<string, string>();
  const root = (id: string): string => {
    const parent = parents.get(id);
    if (!parent || parent === id) {
      parents.set(id, id);
      return id;
    }
    const resolved = root(parent);
    parents.set(id, resolved);
    return resolved;
  };
  const merge = (a: string, b: string) => {
    const x = root(a),
      y = root(b);
    if (x !== y) parents.set(x, y);
  };
  for (const card of cards) {
    merge(card.id, card.canonical_card_id);
    const number = normalizeCardNumber(card.card_number),
      previous = numbers.get(number);
    if (previous) merge(card.id, previous);
    else numbers.set(number, card.id);
  }
  return new Map([...parents.keys()].map((id) => [id, root(id)]));
}

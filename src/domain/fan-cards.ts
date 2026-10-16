import type { Database } from "@/lib/supabase/database.types";

// Display-only original fan cards, independent from playable leader variants.
export type FanCard = Database["public"]["Tables"]["fan_cards"]["Row"];
export const fanEdition = {
  id: "fan-pirate-gods",
  name: "LEGENDARIA BANDA DE LOS DIOSES PIRATAS",
} as const;
export const fanArtworks = [
  {
    id: "vin-d-ny",
    cardId: "5086888e-aee5-4295-8bd9-f9f1dafbb718",
    fileName: "vin-d-ny.jpg",
    contentType: "image/jpeg",
  },
] as const;
export function fanArtworkForCard(card: Pick<FanCard, "id" | "artwork_id">) {
  return fanArtworks.find(
    (art) => art.cardId === card.id && art.id === card.artwork_id,
  );
}
export function filterFanCards(cards: readonly FanCard[], search: string) {
  const query = search.trim().normalize("NFKC").toLocaleLowerCase("es");
  return cards.filter((card) =>
    `${card.name} ${card.display_number ?? ""}`
      .normalize("NFKC")
      .toLocaleLowerCase("es")
      .includes(query),
  );
}

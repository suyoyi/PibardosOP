import type { Database } from "@/lib/supabase/database.types";

// Display-only original fan cards, independent from playable leader variants.
export type FanCard = Database["public"]["Tables"]["fan_cards"]["Row"];
export type FanCardVariant =
  Database["public"]["Tables"]["fan_card_variants"]["Row"];
export const fanEdition = {
  id: "fan-pirate-gods",
  name: "LEGENDARIA BANDA DE LOS DIOSES PIRATAS",
} as const;
// The order is editorial, independent from names, display numbers or artwork.
export const fanCrew = [
  {
    cardId: "5086888e-aee5-4295-8bd9-f9f1dafbb718",
    role: "Músico de la tripulación",
  },
  {
    cardId: "a8e7d1f8-62d5-48f6-9a39-1f7f6cf91d42",
    role: "Tirador de la tripulación",
  },
  {
    cardId: "36e3be70-e149-483c-806e-94e78edcf9dd",
    role: "Luchador de la tripulación",
  },
  {
    cardId: "eaf31cf6-f972-4b9e-a8df-c6d7c3db0904",
    role: "Espadachín de la tripulación",
  },
  {
    cardId: "d26d3b48-7e0c-4c72-b274-9c99e3ab7a05",
    role: "Navegante de la tripulación",
  },
  {
    cardId: "a254ffb8-c517-409e-872a-9f14a4388306",
    role: "Médico de la tripulación",
  },
  {
    cardId: "d515ca79-15ba-4f9f-b730-d5fba7f27a07",
    role: "Capitán de la tripulación",
  },
] as const;

export function fanGalleryEntries(
  cards: readonly FanCard[],
  revealedCardIds: readonly string[],
  search: string,
) {
  const revealed = new Set(revealedCardIds);
  const query = search.trim().normalize("NFKC").toLocaleLowerCase("es");
  return fanCrew.flatMap(({ cardId, role }) => {
    const card = cards.find((card) => card.id === cardId);
    if (!card) return [];
    const isRevealed = revealed.has(cardId);
    const searchable = `${role} ${isRevealed ? `${card.name} ${card.display_number ?? ""}` : ""}`;
    return searchable.normalize("NFKC").toLocaleLowerCase("es").includes(query)
      ? [{ card, role, revealed: isRevealed }]
      : [];
  });
}
export const fanArtworks = [
  {
    id: "vin-d-ny",
    cardId: "5086888e-aee5-4295-8bd9-f9f1dafbb718",
    fileName: "vin-d-ny.jpg",
    contentType: "image/jpeg",
  },
  {
    id: "mario-d-bestia",
    cardId: "36e3be70-e149-483c-806e-94e78edcf9dd",
    fileName: "mario-d-bestia.jpg",
    contentType: "image/jpeg",
  },
  {
    id: "aar-d-on",
    cardId: "a8e7d1f8-62d5-48f6-9a39-1f7f6cf91d42",
    fileName: "aar-d-on.jpg",
    contentType: "image/jpeg",
  },
  {
    id: "christian-d-bermejo",
    cardId: "eaf31cf6-f972-4b9e-a8df-c6d7c3db0904",
    fileName: "christian-d-bermejo.jpg",
    contentType: "image/jpeg",
  },
  {
    id: "jaime-d-dragneel",
    cardId: "d26d3b48-7e0c-4c72-b274-9c99e3ab7a05",
    fileName: "jaime-d-dragneel.jpg",
    contentType: "image/jpeg",
  },
  {
    id: "joan-d-cuadras",
    cardId: "a254ffb8-c517-409e-872a-9f14a4388306",
    fileName: "joan-d-cuadras.jpg",
    contentType: "image/jpeg",
  },
  {
    id: "su-d-yoyi",
    cardId: "d515ca79-15ba-4f9f-b730-d5fba7f27a07",
    fileName: "su-d-yoyi.jpg",
    contentType: "image/jpeg",
  },
  {
    id: "su-d-yoyi-awakening",
    cardId: "d515ca79-15ba-4f9f-b730-d5fba7f27a07",
    fileName: "su-d-yoyi-awakening.jpg",
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
export function fanArtworkOptions(
  card: FanCard,
  variants: readonly FanCardVariant[],
) {
  const original = fanArtworkForCard(card);
  const options = original ? [{ ...original, label: "Original" }] : [];
  for (const variant of variants) {
    if (
      variant.fan_card_id !== card.id ||
      variant.artwork_id === card.artwork_id
    )
      continue;
    const art = fanArtworkForCard({
      id: card.id,
      artwork_id: variant.artwork_id,
    });
    if (art && !options.some((option) => option.id === art.id))
      options.push({ ...art, label: variant.label });
  }
  return options;
}

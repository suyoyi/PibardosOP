import type { Card } from "./cards";
export function isCustomArtwork(card: object) {
  return "source" in card && card.source === "custom-artwork";
}
// Original artwork supplied by the owner. IDs match the immutable catalog migration.
export const customArtworks = [
  {
    id: "roronoa-vinny",
    cardId: "3492c35f-0975-46a7-a35e-08b1be78f3e1",
    canonicalCardId: "9bb1bfc0-cb7e-45ce-bde5-ed75656df3e8",
    cardNumber: "OP12-020",
    name: "Roronoa Vinny",
    printingCode: "custom-roronoa-vinny",
    fileName: "roronoa-vinny.png",
    contentType: "image/png",
  },
  {
    id: "rocks-d-bermejo",
    cardId: "db196a52-a889-4d04-8d93-34dddde3f7fc",
    canonicalCardId: "e297b3be-ea1e-46c7-9850-7af237c09221",
    cardNumber: "OP17-039",
    name: "Rocks D. Bermejo",
    printingCode: "custom-rocks-d-bermejo",
    fileName: "rocks-d-bermejo.png",
    contentType: "image/png",
  },
] as const;
export function customArtworkForCard(
  card: Pick<Card, "id" | "source" | "card_number" | "printing_code">,
) {
  return card.source === "custom-artwork"
    ? customArtworks.find(
        (a) =>
          a.cardId === card.id &&
          a.cardNumber === card.card_number &&
          a.printingCode === card.printing_code,
      )
    : undefined;
}

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  fanArtworkForCard,
  filterFanCards,
  fanArtworkOptions,
  fanGalleryEntries,
} from "../../src/domain/fan-cards";
import {
  fanCardFixtures,
  fanVariantFixtures,
  suFanCard,
  marioFanCard,
  suAlternateVariant,
  suAlternateImageHash,
} from "../fixtures/fan-cards";

describe.each(fanCardFixtures)("$card.name", ({ card, imageHash }) => {
  it("preserves the original owner JPEG and binds artwork to its independent fan identity", () => {
    const art = fanArtworkForCard(card)!;
    expect(art.contentType).toBe("image/jpeg");
    expect(
      createHash("sha256")
        .update(readFileSync(`assets/custom-artworks/${art.fileName}`))
        .digest("hex"),
    ).toBe(imageHash);
    expect(fanArtworkForCard({ ...card, id: "unregistered" })).toBeUndefined();
    expect(
      fanArtworkForCard({ ...card, artwork_id: "roronoa-vinny" }),
    ).toBeUndefined();
  });
  it("finds the fan name or display code without turning it into an official card number", () => {
    for (const query of [
      "",
      `  ${card.name.toUpperCase()} `,
      card.display_number!.toLowerCase(),
      card.display_number!.replace(/[A-Z0-9]/g, (c) =>
        String.fromCharCode(c.charCodeAt(0) + 0xfee0),
      ),
    ])
      expect(filterFanCards([card], query)).toEqual([card]);
    for (const query of [
      "Roronoa Vinny",
      "Rocks D. Bermejo",
      "OP12-020",
      "OP17-039",
    ])
      expect(filterFanCards([card], query)).toEqual([]);
  });
});

it("orders the crew by the owner's roles and hides undiscovered identities from search", () => {
  const cards = fanCardFixtures.map(({ card }) => card).reverse();
  const locked = fanGalleryEntries(cards, [], "");
  expect(
    locked.map(({ card, role, revealed }) => [card.artwork_id, role, revealed]),
  ).toEqual([
    ["vin-d-ny", "Músico de la tripulación", false],
    ["aar-d-on", "Tirador de la tripulación", false],
    ["mario-d-bestia", "Luchador de la tripulación", false],
    ["christian-d-bermejo", "Espadachín de la tripulación", false],
    ["jaime-d-dragneel", "Navegante de la tripulación", false],
    ["joan-d-cuadras", "Médico de la tripulación", false],
    ["su-d-yoyi", "Capitán de la tripulación", false],
  ]);
  for (const { card } of fanCardFixtures) {
    expect(fanGalleryEntries(cards, [], card.name)).toEqual([]);
    expect(fanGalleryEntries(cards, [], card.display_number!)).toEqual([]);
    expect(fanGalleryEntries(cards, [card.id], card.name)).toMatchObject([
      { card, revealed: true },
    ]);
  }
  expect(fanGalleryEntries(cards, [suFanCard.id], "  CAPITÁN ")).toMatchObject([
    { card: suFanCard, revealed: true },
  ]);
  expect(
    fanGalleryEntries(cards, ["unregistered"], "").every(
      (entry) => !entry.revealed,
    ),
  ).toBe(true);
});

it("binds the unchanged alternate JPEG to Su D. Yoyi while keeping the original illustration first", () => {
  const options = fanArtworkOptions(suFanCard, fanVariantFixtures);
  expect(options.map((o) => [o.id, o.label])).toEqual([
    ["su-d-yoyi", "Original"],
    ["su-d-yoyi-awakening", "Arte alternativo"],
  ]);
  const bytes = readFileSync(`assets/custom-artworks/${options[1].fileName}`);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(
    suAlternateImageHash,
  );
  expect(options[1].cardId).toBe(suFanCard.id);
});
it("does not mix artwork from other cards or unregistered or duplicate variant references", () => {
  const references = [
    ...fanVariantFixtures,
    { ...suAlternateVariant, label: "Duplicate" },
    { ...suAlternateVariant, artwork_id: suFanCard.artwork_id },
    { ...suAlternateVariant, artwork_id: "unregistered" },
    { ...suAlternateVariant, artwork_id: "mario-d-bestia" },
    { ...suAlternateVariant, fan_card_id: "other-card" },
  ];
  expect(fanArtworkOptions(suFanCard, references)).toHaveLength(2);
  expect(fanArtworkOptions(marioFanCard, references).map((o) => o.id)).toEqual([
    marioFanCard.artwork_id,
  ]);
  expect(fanArtworkOptions(suFanCard, []).map((o) => o.id)).toEqual([
    suFanCard.artwork_id,
  ]);
});

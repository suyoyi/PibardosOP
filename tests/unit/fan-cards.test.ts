import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fanArtworkForCard, filterFanCards } from "../../src/domain/fan-cards";
import { fanCardFixtures } from "../fixtures/fan-cards";

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

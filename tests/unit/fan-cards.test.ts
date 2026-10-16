import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fanArtworkForCard, filterFanCards } from "../../src/domain/fan-cards";
import { vinFanCard, vinFanImageHash } from "../fixtures/fan-cards";

it("preserves the original owner JPEG and binds artwork to its independent fan identity", () => {
  const art = fanArtworkForCard(vinFanCard)!;
  expect(art.contentType).toBe("image/jpeg");
  expect(
    createHash("sha256")
      .update(readFileSync(`assets/custom-artworks/${art.fileName}`))
      .digest("hex"),
  ).toBe(vinFanImageHash);
  expect(
    fanArtworkForCard({ ...vinFanCard, id: "unregistered" }),
  ).toBeUndefined();
  expect(
    fanArtworkForCard({ ...vinFanCard, artwork_id: "roronoa-vinny" }),
  ).toBeUndefined();
});
it("finds the fan name or display code without turning it into an official card number", () => {
  for (const query of [
    "",
    "  VIN D. NY ",
    "dj del caos",
    "op-001",
    "ＯＰ-００１",
  ])
    expect(filterFanCards([vinFanCard], query)).toEqual([vinFanCard]);
  for (const query of [
    "Roronoa Vinny",
    "Rocks D. Bermejo",
    "OP12-020",
    "OP17-039",
  ])
    expect(filterFanCards([vinFanCard], query)).toEqual([]);
});

import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  customArtworks,
  customArtworkForCard,
} from "../../src/domain/custom-artworks";
import {
  mergeCardCandidates,
  groupCardVariants,
} from "../../src/domain/card-variants";
import { syntheticCard } from "../fixtures/cards";
import { normalizeOptcgCard } from "../../src/domain/optcg";
import { optcgRecord } from "../fixtures/optcg";
import { buildDeckDisplay } from "../../src/domain/deck-prices";
import { canonicalGroups } from "../../src/domain/cards";
const art = customArtworks[0];
const base = syntheticCard(1, {
  id: art.canonicalCardId,
  canonical_card_id: art.canonicalCardId,
  card_number: art.cardNumber,
  card_type: "leader",
  source: "optcgapi-catalog",
  printing_code: art.cardNumber,
  provider_card_id: "optcg_sets_OP12-020",
});
const custom = {
  ...base,
  id: art.cardId,
  name: art.name,
  source: "custom-artwork",
  printing_code: art.printingCode,
  provider_card_id: null,
};
it("serves only the registered custom identity and preserves the exact owner-supplied PNG", () => {
  expect(customArtworkForCard(custom)).toEqual(art);
  for (const invalid of [
    { ...custom, id: base.id },
    { ...custom, source: "manual" },
    { ...custom, card_number: "OP17-039" },
    { ...custom, printing_code: "standard" },
  ])
    expect(customArtworkForCard(invalid)).toBeUndefined();
  const bytes = readFileSync(`assets/custom-artworks/${art.fileName}`);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(
    "9bbc59e00229acbaa0d6f898e50c0f4e608550380b393900efa9be1ecbddeefd",
  );
});
it("groups custom art with the original canonical leader and keeps a base fallback", () => {
  const groups = groupCardVariants(mergeCardCandidates([custom, base], []));
  expect(groups).toHaveLength(1);
  expect(
    groups[0].representative.kind === "saved"
      ? groups[0].representative.card.id
      : null,
  ).toBe(base.id);
  expect(groups[0].variants).toHaveLength(2);
  expect(canonicalGroups([base, custom]).get(custom.id)).toBe(base.id);
});
it("prefers an available or cached provider base without duplicating the fallback or losing custom art", () => {
  const remote = normalizeOptcgCard(
    optcgRecord({
      card_set_id: art.cardNumber,
      card_image_id: art.cardNumber,
      card_type: "Leader",
    }),
    "sets",
  );
  const merged = mergeCardCandidates([base, custom], [remote]);
  expect(merged).toHaveLength(2);
  expect(merged.some((c) => c.kind === "remote")).toBe(true);
  const cached = { ...base, id: syntheticCard(9).id, source: "optcgapi" };
  expect(
    mergeCardCandidates([base, custom, cached], [remote]).map((c) =>
      c.kind === "saved" ? c.card.id : null,
    ),
  ).toEqual([custom.id, cached.id]);
});
it("does not give custom artwork an official printing market price", () => {
  const result = buildDeckDisplay(
    custom.id,
    [],
    [base, custom],
    [
      {
        card_id: custom.id,
        external_id: "optcg_sets_OP12-020",
        prices: [{ metric: "market_price", amount: 999, currency: null }],
        fetched_at: "2026-10-15T12:00:00Z",
        source_date: "2026-10-14",
      },
    ],
  );
  expect(result.rows[0].unitPrice).toBeNull();
  expect(result.total.complete).toBe(false);
});

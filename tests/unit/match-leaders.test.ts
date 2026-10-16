import { it, expect } from "vitest";
import {
  matchLeaderChoices,
  searchMatchLeaders,
} from "../../src/domain/match-leaders";
import { normalizeOptcgCard } from "../../src/domain/optcg";
import { optcgRecord } from "../fixtures/optcg";
import { syntheticCard } from "../fixtures/cards";
const saved = syntheticCard(1, { card_type: "leader" });
const base = normalizeOptcgCard(optcgRecord({ card_type: "Leader" }), "sets");
const alt = normalizeOptcgCard(
  optcgRecord({ card_type: "Leader", card_image_id: "OP97-010_p1" }),
  "sets",
);
it("shows each imported or source printed leader once, preferring known base artwork", () => {
  const choices = matchLeaderChoices(
    [saved, { ...saved, id: "alternate", printing_code: "alternate" }],
    [alt, base],
  );
  expect(choices).toHaveLength(2);
  expect(choices.map((c) => c.card)).toEqual([saved, base]);
});
it("prefers an available source base when only its alternate was privately cached", () => {
  const cached = {
    ...saved,
    card_number: alt.card_number,
    provider_card_id: alt.external_id,
    printing_code: alt.variant,
    source: "optcgapi",
  };
  expect(matchLeaderChoices([cached], [alt, base])).toEqual([
    { kind: "remote", card: base },
  ]);
});
it("keeps immutable cached facts and exact IDs when the base already belongs to the user", () => {
  const cached = {
    ...saved,
    name: "Saved original facts",
    card_number: base.card_number,
    provider_card_id: base.external_id,
    printing_code: base.variant,
    source: "optcgapi",
  };
  expect(matchLeaderChoices([cached], [base, alt])).toEqual([
    { kind: "saved", card: cached },
  ]);
});
it("does not merge different leaders by name and retains a sole artwork honestly", () => {
  const other = {
    ...saved,
    id: "other",
    card_number: "OP00-002",
    canonical_card_id: saved.id,
  };
  expect(matchLeaderChoices([saved, other], [alt])).toHaveLength(3);
  expect(matchLeaderChoices([], [alt])[0].card.image_url).toBe(alt.image_url);
});
it("offers English leaders only, without characters or invented translations", () => {
  expect(
    matchLeaderChoices(
      [
        saved,
        { ...saved, id: "jp", language: "ja" },
        { ...saved, id: "main", card_type: "character" },
      ],
      [normalizeOptcgCard(optcgRecord(), "sets")],
    ),
  ).toEqual([{ kind: "saved", card: saved }]);
});
it("searches the complete leader list by name and normalized short number", () => {
  const choices = matchLeaderChoices([saved], [base]);
  expect(searchMatchLeaders(choices, "op97-10")).toEqual([
    { kind: "remote", card: base },
  ]);
  expect(searchMatchLeaders(choices, "fixture")).toHaveLength(1);
  expect(searchMatchLeaders(choices, "unavailable")).toHaveLength(0);
  expect(searchMatchLeaders([], "")).toEqual([]);
});

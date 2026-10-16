import { describe, expect, it } from "vitest";
import {
  candidateKey,
  groupCardVariants,
  mergeCardCandidates,
} from "../../src/domain/card-variants";
import { normalizeOptcgCard } from "../../src/domain/optcg";
import { main, alternate, leader, syntheticCard } from "../fixtures/cards";
import { optcgRecord } from "../fixtures/optcg";

describe("printed-number galleries and exact printing identity", () => {
  it("shows one group per printed code without discarding different artwork", () => {
    const merged = mergeCardCandidates(
      [alternate, main, leader, alternate],
      [],
    );
    const groups = groupCardVariants([...merged, merged[0]]);
    expect(groups.map((group) => group.number)).toEqual([
      leader.card_number,
      main.card_number,
    ]);
    expect(groups[1].variants.map(candidateKey)).toEqual([
      main.id,
      alternate.id,
    ]);
    expect(candidateKey(groups[1].representative)).toBe(main.id);
  });
  it("preserves distinct printed numbers even when a reprint shares its canonical copy identity", () => {
    const reprint = syntheticCard(9, {
      card_number: "ST00-002",
      canonical_card_id: main.id,
    });
    expect(
      groupCardVariants(mergeCardCandidates([main, reprint], [])).map(
        (group) => group.number,
      ),
    ).toEqual([main.card_number, reprint.card_number]);
    expect(reprint.canonical_card_id).toBe(main.id);
  });
  it("uses immutable cached facts for the same provider printing while retaining other identities", () => {
    const remote = normalizeOptcgCard(optcgRecord(), "sets");
    const cached = syntheticCard(10, {
      card_number: remote.card_number,
      provider_card_id: remote.external_id,
      source: "optcgapi",
      name: "Saved historical name",
    });
    const other = normalizeOptcgCard(
      optcgRecord({ card_image_id: "OP97-010_p1" }),
      "sets",
    );
    const promo = normalizeOptcgCard(optcgRecord(), "promos");
    const candidates = mergeCardCandidates(
      [cached],
      [remote, other, other, promo],
    );
    expect(candidates).toHaveLength(3);
    expect(candidates[0].kind).toBe("saved");
    expect(candidates[0].card.name).toBe("Saved historical name");
    expect(candidateKey(candidates[0])).toBe(
      candidateKey({ kind: "remote", card: remote }),
    );
    expect(new Set(candidates.map(candidateKey)).size).toBe(3);
    expect(groupCardVariants(candidates)).toHaveLength(1);
  });
  it("selects base art independently of canonical identity or arrival order", () => {
    const remote = normalizeOptcgCard(optcgRecord(), "sets");
    const first = syntheticCard(11, {
      card_number: remote.card_number,
      printing_code: "OP97-010_p1",
      source: "optcgapi",
    });
    const groups = groupCardVariants(mergeCardCandidates([first], [remote]));
    expect(groups[0].representative.kind).toBe("remote");
    expect(groups[0].variants).toHaveLength(2);
  });
});

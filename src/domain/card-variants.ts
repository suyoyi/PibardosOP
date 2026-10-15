import { normalizeCardNumber, type Card } from "./cards";
import type { OptcgCard } from "./optcg";
export type CardCandidate =
  { kind: "saved"; card: Card } | { kind: "remote"; card: OptcgCard };

export function candidateKey(candidate: CardCandidate) {
  return candidate.kind === "saved"
    ? candidate.card.source === "optcgapi" && candidate.card.provider_card_id
      ? candidate.card.provider_card_id
      : candidate.card.id
    : candidate.card.external_id;
}

// A cached printing replaces its remote preview; different printings remain
// distinct even if an upstream image URL or canonical copy identity is shared.
export function mergeCardCandidates(
  saved: readonly Card[],
  remote: readonly OptcgCard[],
): CardCandidate[] {
  const owned = new Set(
    saved
      .filter((card) => card.source === "optcgapi")
      .map((card) => card.provider_card_id),
  );
  return [
    ...new Map(
      saved.map((card) => [card.id, { kind: "saved" as const, card }]),
    ).values(),
    ...new Map(
      remote
        .filter((card) => !owned.has(card.external_id))
        .map((card) => [card.external_id, { kind: "remote" as const, card }]),
    ).values(),
  ];
}

function basePrinting(candidate: CardCandidate) {
  return candidate.kind === "remote"
    ? candidate.card.is_base
    : ["standard", candidate.card.card_number].includes(
        candidate.card.printing_code,
      );
}
export function groupCardVariants(candidates: readonly CardCandidate[]) {
  const groups = new Map<string, CardCandidate[]>();
  for (const candidate of candidates) {
    const code = normalizeCardNumber(candidate.card.card_number);
    const group = groups.get(code) ?? [];
    if (!group.some((item) => candidateKey(item) === candidateKey(candidate)))
      group.push(candidate);
    groups.set(code, group);
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([number, variants]) => {
      const sorted = [...variants].sort(
        (a, b) =>
          Number(basePrinting(b)) - Number(basePrinting(a)) ||
          a.card.name.localeCompare(b.card.name) ||
          candidateKey(a).localeCompare(candidateKey(b)),
      );
      return { number, representative: sorted[0], variants: sorted };
    });
}

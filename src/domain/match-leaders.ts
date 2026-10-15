import { filterCards, type Card } from "./cards";
import {
  groupCardVariants,
  mergeCardCandidates,
  type CardCandidate,
} from "./card-variants";
import type { OptcgCard } from "./optcg";

// Matchups identify a printed leader, not a choice of alternate artwork. Prefer
// a known base when available, while retaining a sole saved artwork as fallback.
export function matchLeaderChoices(
  saved: readonly Card[],
  remote: readonly OptcgCard[],
) {
  return groupCardVariants(
    mergeCardCandidates(
      saved.filter((c) => c.card_type === "leader" && c.language === "en"),
      remote.filter((c) => c.card_type === "leader"),
    ),
  ).map((group) => group.representative);
}
export function searchMatchLeaders(
  choices: readonly CardCandidate[],
  query: string,
) {
  return choices.filter(
    (choice) => filterCards([choice.card], { search: query }).length > 0,
  );
}

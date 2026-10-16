import { filterCards, type Card, type CardFilters } from "./cards";
import {
  candidateKey,
  groupCardVariants,
  mergeCardCandidates,
  type CardCandidate,
} from "./card-variants";
import type { OptcgCard, OptcgQuote } from "./optcg";

export type ExplorerFilters = CardFilters & { rarity?: string; trait?: string };
export type ExplorerPrinting = {
  candidate: CardCandidate;
  expansionName: string | null;
  quote: {
    prices: OptcgQuote[];
    fetchedAt: string;
    sourceDate: string | null;
  } | null;
};
export type ExplorerGroup = { number: string; printings: ExplorerPrinting[] };
export type ExplorerPage = ReturnType<typeof exploreCards>;
export const explorerPageSize = 36;

export function exploreCards(
  saved: readonly Card[],
  remote: readonly OptcgCard[],
  filters: ExplorerFilters,
  requestedPage: number,
  fetchedAt: string,
) {
  const candidates = mergeCardCandidates(
    saved.filter((c) => c.language === "en"),
    remote,
  );
  const facts = candidates.map((c) => c.card);
  const unique = (
    key: "cost" | "power" | "counter" | "attribute" | "rarity" | "traits",
  ) =>
    [
      ...new Set(
        facts.flatMap((card) => {
          const value = card[key];
          return value == null
            ? []
            : Array.isArray(value)
              ? value
              : [String(value)];
        }),
      ),
    ].sort((a, b) =>
      ["cost", "power", "counter"].includes(key)
        ? Number(a) - Number(b)
        : a.localeCompare(b),
    );
  const expansions = new Map<string, { id: string; name: string | null }>();
  for (const card of remote)
    if (card.set_code) {
      const id = card.set_code.replaceAll("-", "").toUpperCase();
      // Promo set IDs sometimes refer to the original printed number's set.
      // Prefer a documented set/starter name for the common expansion option.
      if (
        !expansions.has(id) ||
        card.family === "sets" ||
        card.family === "decks"
      )
        expansions.set(id, { id, name: card.set_name });
    }
  for (const card of saved)
    if (card.language === "en" && card.set_code) {
      const id = card.set_code.replaceAll("-", "").toUpperCase();
      if (!expansions.has(id)) expansions.set(id, { id, name: null });
    }
  const filtered = candidates.filter((candidate) => {
    const card = candidate.card;
    return (
      filterCards([card], filters).length > 0 &&
      (!filters.rarity || card.rarity === filters.rarity) &&
      (!filters.trait || card.traits.includes(filters.trait))
    );
  });
  const groups = groupCardVariants(filtered);
  const pages = Math.max(1, Math.ceil(groups.length / explorerPageSize));
  const page = Math.min(pages, Math.max(1, Math.floor(requestedPage)));
  const allGroups = new Map(
    groupCardVariants(candidates).map((g) => [g.number, g.variants]),
  );
  const metadata = new Map(remote.map((c) => [c.external_id, c]));
  const result: ExplorerGroup[] = groups
    .slice((page - 1) * explorerPageSize, page * explorerPageSize)
    .map((group) => ({
      number: group.number,
      printings: [
        ...group.variants,
        ...(allGroups.get(group.number) ?? []).filter(
          (c) =>
            !group.variants.some((v) => candidateKey(v) === candidateKey(c)),
        ),
      ].map((candidate) => {
        const source = metadata.get(candidateKey(candidate));
        return {
          candidate,
          expansionName:
            source?.set_name ??
            expansions.get(
              candidate.card.set_code?.replaceAll("-", "").toUpperCase() ?? "",
            )?.name ??
            null,
          quote: source
            ? {
                prices: source.prices,
                sourceDate: source.source_date,
                fetchedAt,
              }
            : null,
        };
      }),
    }));
  return {
    groups: result,
    total: groups.length,
    printings: filtered.length,
    page,
    pages,
    options: {
      expansions: [...expansions.values()].sort((a, b) =>
        a.id.localeCompare(b.id),
      ),
      cost: unique("cost"),
      power: unique("power"),
      counter: unique("counter"),
      attribute: unique("attribute"),
      rarity: unique("rarity"),
      trait: unique("traits"),
    },
  };
}

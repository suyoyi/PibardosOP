import "server-only";
import type { AppClient } from "./data";
import type { SavedDeckQuote } from "@/domain/deck-prices";

export async function getDeckQuotes(db: AppClient, cardIds: readonly string[]) {
  const ids = [...new Set(cardIds)],
    quotes: SavedDeckQuote[] = [];
  // Filter every read to this deck, with bounded batches below PostgREST limits.
  for (let start = 0; start < ids.length; start += 100) {
    const { data, error } = await db
      .from("optcg_card_items")
      .select("card_id,external_id,prices,fetched_at,source_date")
      .in("card_id", ids.slice(start, start + 100));
    if (error)
      return {
        quotes: [],
        error:
          "No se pudieron leer los precios guardados. Recarga la página para reintentarlo.",
      };
    quotes.push(...data);
  }
  return { quotes };
}

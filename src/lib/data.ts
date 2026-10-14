import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";
import {
  filterCards,
  type CardProvider,
  type CardFilters,
} from "@/domain/cards";
export type AppClient = SupabaseClient<Database>;
export type Match = Database["public"]["Tables"]["matches"]["Row"];
export type Tournament = Database["public"]["Tables"]["tournaments"]["Row"];
export type Round = Database["public"]["Tables"]["tournament_rounds"]["Row"];
// Explicit pagination avoids PostgREST's default row limit corrupting lists or percentages.
export async function readAll<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const response = await page(from, from + 499);
    if (response.error || !response.data)
      throw new Error(
        "No se pudieron cargar los datos. Comprueba la conexión.",
      );
    rows.push(...response.data);
    if (response.data.length < 500) return rows;
  }
}
export async function getCatalog(db: AppClient) {
  return readAll((a, b) =>
    db.from("cards").select("*").order("id").range(a, b),
  );
}
export class ManualCatalogProvider implements CardProvider {
  constructor(private readonly db: AppClient) {}
  async search(filters: CardFilters) {
    return filterCards(await getCatalog(this.db), filters);
  }
  async getCard(id: string) {
    const { data, error } = await this.db
      .from("cards")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error("No se pudo consultar la carta.");
    return data;
  }
  async synchronize() {
    return {
      mode: "manual" as const,
      imported: 0,
      message:
        "Catálogo manual. No hay una fuente externa autorizada configurada.",
    };
  }
}
export async function getDeckWorkspace(db: AppClient) {
  const [catalog, restrictions, decks, versions, entries] = await Promise.all([
    getCatalog(db),
    readAll((a, b) =>
      db.from("card_restrictions").select("*").order("id").range(a, b),
    ),
    readAll((a, b) =>
      db
        .from("decks")
        .select("*")
        .order("updated_at", { ascending: false })
        .order("id")
        .range(a, b),
    ),
    readAll((a, b) =>
      db
        .from("deck_versions")
        .select("*")
        .order("deck_id")
        .order("version_number")
        .range(a, b),
    ),
    readAll((a, b) =>
      db
        .from("deck_cards")
        .select("*")
        .order("deck_version_id")
        .order("card_id")
        .range(a, b),
    ),
  ]);
  return { catalog, restrictions, decks, versions, entries };
}
export async function getCompetitiveWorkspace(db: AppClient) {
  const [deckWorkspace, matches, tournaments, rounds] = await Promise.all([
    getDeckWorkspace(db),
    readAll((a, b) =>
      db
        .from("matches")
        .select("*")
        .order("played_at", { ascending: false })
        .order("id")
        .range(a, b),
    ),
    readAll((a, b) =>
      db
        .from("tournaments")
        .select("*")
        .order("event_date", { ascending: false })
        .order("id")
        .range(a, b),
    ),
    readAll((a, b) =>
      db
        .from("tournament_rounds")
        .select("*")
        .order("tournament_id")
        .order("round_number")
        .range(a, b),
    ),
  ]);
  return { ...deckWorkspace, matches, tournaments, rounds };
}

"use server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { getCatalog } from "@/lib/data";
import { publicCatalog } from "@/lib/public-catalog";
import { exploreCards } from "@/domain/card-explorer";

const inputSchema = z
  .object({
    page: z.number().int().min(1).max(100000),
    filters: z
      .object({
        search: z.string().max(120).optional(),
        set: z.string().max(40).optional(),
        color: z
          .enum(["", "red", "green", "blue", "purple", "black", "yellow"])
          .optional(),
        type: z
          .enum(["", "leader", "character", "event", "stage", "don"])
          .optional(),
        cost: z
          .string()
          .regex(/^\d{0,5}$/)
          .optional(),
        power: z
          .string()
          .regex(/^\d{0,10}$/)
          .optional(),
        counter: z
          .string()
          .regex(/^\d{0,10}$/)
          .optional(),
        attribute: z.string().max(200).optional(),
        rarity: z.string().max(100).optional(),
        trait: z.string().max(3000).optional(),
      })
      .strict(),
  })
  .strict();

export async function browseCardCatalog(input: unknown) {
  const { supabase } = await requireUser();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success)
    return { error: "Revisa los filtros y vuelve a intentarlo." };
  try {
    const [saved, source] = await Promise.all([
      getCatalog(supabase),
      publicCatalog(),
    ]);
    const issues = [...source.result.issues];
    const result = exploreCards(
      saved,
      source.result.cards,
      parsed.data.filters,
      parsed.data.page,
      source.fetchedAt,
    );
    // Saved immutable facts remain browsable during a provider outage; quotes
    // are separate private metadata, read only for the visible page under RLS.
    const ids = result.groups.flatMap((g) =>
      g.printings.flatMap((p) =>
        p.candidate.kind === "saved" && !p.quote ? [p.candidate.card.id] : [],
      ),
    );
    if (ids.length) {
      const { data, error } = await supabase
        .from("optcg_card_items")
        .select("card_id,prices,fetched_at,source_date")
        .in("card_id", ids);
      if (error) issues.push("No se pudieron leer algunos precios guardados.");
      const quoteSchema = z.array(
        z.object({
          metric: z.enum(["market_price", "inventory_price"]),
          amount: z.number().finite().nonnegative(),
          currency: z.null(),
        }),
      );
      for (const group of result.groups)
        for (const printing of group.printings) {
          if (printing.quote || printing.candidate.kind !== "saved") continue;
          const cardId = printing.candidate.card.id;
          const stored = data?.find((row) => row.card_id === cardId);
          const prices = quoteSchema.safeParse(stored?.prices);
          if (stored && prices.success)
            printing.quote = {
              prices: prices.data,
              fetchedAt: stored.fetched_at,
              sourceDate: stored.source_date,
            };
        }
    }
    return { ...result, issues, received: source.result.received };
  } catch {
    return {
      error:
        "No se pudo cargar el catálogo. Comprueba la conexión y vuelve a intentarlo.",
    };
  }
}

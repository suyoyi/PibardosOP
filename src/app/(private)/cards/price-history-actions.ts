"use server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { optcgClient } from "@/lib/optcg";
import { familySchema, optcgIdSchema, OptcgError } from "@/domain/optcg";
import { cardNumberPattern, normalizeCardNumber } from "@/domain/cards";

const selectionSchema = z
  .object({
    card_number: z
      .string()
      .max(30)
      .transform(normalizeCardNumber)
      .refine((n) => cardNumberPattern.test(n)),
    external_id: optcgIdSchema,
    family: familySchema,
  })
  .strict()
  .refine((s) => s.external_id.startsWith(`optcg_${s.family}_`));

export async function getCardPriceHistory(selection: unknown) {
  await requireUser();
  const parsed = selectionSchema.safeParse(selection);
  if (!parsed.success)
    return {
      error: "No se pudo identificar la impresión para consultar su histórico.",
    };
  try {
    return await optcgClient().priceHistory(parsed.data);
  } catch (error) {
    return {
      error:
        error instanceof OptcgError && error.code === "RATE_LIMIT"
          ? error.message
          : "El histórico de precios no está disponible ahora mismo. OPTCG API no ha permitido completar la consulta. Puedes volver a intentarlo más tarde.",
    };
  }
}

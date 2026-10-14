"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { optcgClient, OptcgProvider } from "@/lib/optcg";
import {
  OptcgError,
  familySchema,
  optcgIdSchema,
  optcgSetSchema,
  type OptcgCard,
} from "@/domain/optcg";
import {
  cardNumberPattern,
  normalizeCardNumber,
  type Card,
} from "@/domain/cards";
import type { ActionState } from "@/domain/forms";
function failure(error: unknown): ActionState {
  return {
    error:
      error instanceof OptcgError
        ? error.message
        : "No se pudo consultar OPTCG API. Tu catálogo guardado sigue disponible.",
  };
}
export async function searchOptcg(
  query: string,
  family: unknown = "sets",
): Promise<{
  error?: string;
  cards?: OptcgCard[];
  issues?: string[];
  received?: number;
}> {
  await requireUser();
  try {
    const f = familySchema.safeParse(family);
    if (!f.success) return { error: "Grupo de cartas no válido." };
    return await optcgClient().search(query, f.data);
  } catch (e) {
    return failure(e);
  }
}
export async function browseOptcg(
  mode: unknown,
  family: unknown = "sets",
  collection: unknown = "OP01",
): Promise<{
  error?: string;
  cards?: OptcgCard[];
  issues?: string[];
  received?: number;
}> {
  await requireUser();
  const f = familySchema.safeParse(family),
    m = z.enum(["leader", "cards"]).safeParse(mode);
  if (!f.success || !m.success)
    return { error: "Selección de catálogo no válida." };
  try {
    const api = optcgClient();
    if (m.data === "leader") return await api.leaders(f.data);
    if (f.data === "don") return await api.cards("DON!!", "don");
    const code = optcgSetSchema.safeParse(collection);
    if (!code.success)
      return {
        error: "Selecciona una colección válida, por ejemplo OP01 o ST01.",
      };
    if (f.data === "promos") return await api.promoCollection(code.data);
    if (f.data === "decks" && !code.data.startsWith("ST"))
      return {
        error: "Para mazos iniciales, usa una colección ST, por ejemplo ST01.",
      };
    return await api.set(code.data);
  } catch (e) {
    return failure(e);
  }
}
const selectionSchema = z
  .object({
    external_id: optcgIdSchema,
    family: familySchema,
    card_number: z
      .string()
      .transform(normalizeCardNumber)
      .refine((n) => cardNumberPattern.test(n)),
  })
  .refine((v) => v.external_id.startsWith(`optcg_${v.family}_`));

export async function getOptcgBuilderCard(
  selection: unknown,
): Promise<{ card?: Card; error?: string }> {
  const { supabase, user } = await requireUser(),
    input = selectionSchema.safeParse(selection);
  if (!input.success)
    return { error: "Selecciona una impresión válida del buscador." };
  try {
    const { data: cached, error } = await supabase
      .from("cards")
      .select("*")
      .eq("user_id", user.id)
      .eq("source", "optcgapi")
      .eq("provider_card_id", input.data.external_id)
      .eq("card_number", input.data.card_number)
      .maybeSingle();
    if (error)
      throw new OptcgError(
        "PERSISTENCE",
        "No se pudo consultar la ficha. Reintenta sin salir del editor.",
      );
    if (cached) return { card: cached };
    const provider = new OptcgProvider(supabase),
      id = await provider.importCard(
        input.data.card_number,
        input.data.external_id,
        input.data.family,
      );
    const card = await provider.getCard(id);
    if (!card)
      throw new OptcgError(
        "PERSISTENCE",
        "No se pudo recuperar la ficha añadida. Reintenta sin salir del editor.",
      );
    // Return data without navigation/revalidation so the unsaved editor is preserved.
    return { card };
  } catch (e) {
    return failure(e);
  }
}
export async function importOptcgCard(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const input = selectionSchema.safeParse(Object.fromEntries(form));
  if (!input.success)
    return { error: "Selecciona una impresión válida del proveedor." };
  let cardId: string;
  try {
    cardId = await new OptcgProvider(supabase).importCard(
      input.data.card_number,
      input.data.external_id,
      input.data.family,
    );
  } catch (e) {
    return failure(e);
  }
  revalidatePath("/", "layout");
  redirect(`/cards/${cardId}?saved=1`);
}
export async function syncOptcgSet(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser(),
    code = optcgSetSchema.safeParse(form.get("set_code"));
  if (!code.success)
    return {
      error: "Código no válido. Usa OP01, EB01, PRB01 o ST01, por ejemplo.",
    };
  try {
    const result = await new OptcgProvider(supabase, code.data).synchronize();
    revalidatePath("/", "layout");
    return { success: result.message };
  } catch (e) {
    revalidatePath("/", "layout");
    return failure(e);
  }
}
export async function refreshOptcgPrices(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser(),
    id = optcgIdSchema.safeParse(form.get("external_id"));
  if (!id.success) return { error: "Impresión no válida." };
  const { data: cached, error } = await supabase
    .from("optcg_card_items")
    .select("fetched_at,family,cards!inner(card_number)")
    .eq("external_id", id.data)
    .maybeSingle();
  if (error || !cached)
    return { error: "Esta impresión no está en tu catálogo." };
  if (Date.now() - Date.parse(cached.fetched_at) < 15 * 60 * 1000)
    return {
      success:
        "La consulta guardada tiene menos de 15 minutos. Se reutiliza para reducir llamadas.",
    };
  const family = familySchema.safeParse(cached.family);
  if (!family.success) return { error: "Referencia del proveedor no válida." };
  try {
    await new OptcgProvider(supabase).importCard(
      cached.cards.card_number,
      id.data,
      family.data,
    );
    revalidatePath("/", "layout");
    return {
      success:
        "Precios consultados. Se conserva la ficha histórica de la carta.",
    };
  } catch (e) {
    return failure(e);
  }
}

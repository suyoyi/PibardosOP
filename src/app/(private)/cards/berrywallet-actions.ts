"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { berryClient, BerryWalletProvider } from "@/lib/berrywallet";
import {
  BerryWalletError,
  externalIdSchema,
  setCodeSchema,
  type BerryLanguage,
  type BerryPreview,
} from "@/domain/berrywallet";
import type { ActionState } from "@/domain/forms";
function failure(error: unknown): ActionState {
  return {
    error:
      error instanceof BerryWalletError
        ? error.message
        : "No se pudo consultar BerryWallet. Tu catálogo guardado sigue disponible.",
  };
}
function language(value: FormDataEntryValue | null): BerryLanguage {
  return value === "jp" ? "jp" : "en";
}
export async function searchBerryWallet(
  query: string,
  page = 1,
): Promise<{ error?: string; cards?: BerryPreview[]; total?: number }> {
  await requireUser();
  try {
    const result = await berryClient().search(query, page);
    return { cards: result.data, total: result.total };
  } catch (error) {
    return failure(error);
  }
}
export async function importBerryWalletCard(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser(),
    id = externalIdSchema.safeParse(form.get("external_id"));
  if (!id.success)
    return { error: "Selecciona una carta válida del proveedor." };
  let cardId: string;
  try {
    cardId = await new BerryWalletProvider(supabase, "en").importCard(id.data);
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/", "layout");
  redirect(`/cards/${cardId}?saved=1`);
}
export async function syncBerryWalletSet(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser(),
    code = setCodeSchema.safeParse(form.get("set_code"));
  if (!code.success)
    return { error: "Código de colección no válido. Usa, por ejemplo, OP01." };
  try {
    const result = await new BerryWalletProvider(
      supabase,
      language(form.get("language")),
      code.data,
    ).synchronize();
    revalidatePath("/", "layout");
    return { success: result.message };
  } catch (error) {
    revalidatePath("/", "layout");
    return failure(error);
  }
}
export async function refreshBerryWalletPrice(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser(),
    id = externalIdSchema.safeParse(form.get("external_id"));
  if (!id.success) return { error: "Carta del proveedor no válida." };
  const { data: cached, error } = await supabase
    .from("card_provider_items")
    .select("fetched_at,cards!inner(language)")
    .eq("external_id", id.data)
    .maybeSingle();
  if (error || !cached) return { error: "Esta carta no está en tu catálogo." };
  if (Date.now() - Date.parse(cached.fetched_at) < 15 * 60 * 1000)
    return {
      success:
        "La consulta guardada tiene menos de 15 minutos. Se conserva para ahorrar cuota.",
    };
  try {
    await new BerryWalletProvider(
      supabase,
      cached.cards.language === "ja" ? "jp" : "en",
    ).importCard(id.data);
    revalidatePath("/", "layout");
    return {
      success:
        "Precios consultados. La ficha histórica de la carta se conserva.",
    };
  } catch (e) {
    return failure(e);
  }
}

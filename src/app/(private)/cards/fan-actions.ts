"use server";
import { requireUser } from "@/lib/supabase/server";
import { getFanWorkspace } from "@/lib/data";
import { z } from "zod";
import { fanCrew } from "@/domain/fan-cards";
import { revalidatePath } from "next/cache";
export async function getBuilderFanCatalog() {
  const { supabase } = await requireUser();
  try {
    return await getFanWorkspace(supabase);
  } catch {
    return {
      cards: [],
      variants: [],
      revealedCardIds: [],
      error:
        "No se pudo cargar la edición personalizada. Comprueba la conexión y reintenta.",
    };
  }
}

export async function revealFanCard(
  input: unknown,
): Promise<{ success: true } | { error: string }> {
  const { supabase, user } = await requireUser();
  const id = z.uuid().safeParse(input);
  if (!id.success || !fanCrew.some((member) => member.cardId === id.data))
    return { error: "No se reconoce esta carta de la tripulación." };
  const { error } = await supabase
    .from("fan_card_unlocks")
    .upsert(
      { user_id: user.id, fan_card_id: id.data },
      { onConflict: "user_id,fan_card_id", ignoreDuplicates: true },
    );
  if (error)
    return {
      error:
        "No se pudo guardar el desbloqueo. Comprueba la conexión y vuelve a pulsar el botón.",
    };
  revalidatePath("/cards");
  return { success: true };
}

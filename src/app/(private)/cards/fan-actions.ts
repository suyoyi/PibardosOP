"use server";
import { requireUser } from "@/lib/supabase/server";
import { getFanCatalog } from "@/lib/data";
export async function getBuilderFanCatalog() {
  const { supabase } = await requireUser();
  try {
    return { cards: await getFanCatalog(supabase) };
  } catch {
    return {
      cards: [],
      error:
        "No se pudo cargar la edición personalizada. Comprueba la conexión y reintenta.",
    };
  }
}

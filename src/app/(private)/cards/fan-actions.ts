"use server";
import { requireUser } from "@/lib/supabase/server";
import { getFanWorkspace } from "@/lib/data";
export async function getBuilderFanCatalog() {
  const { supabase } = await requireUser();
  try {
    return await getFanWorkspace(supabase);
  } catch {
    return {
      cards: [],
      variants: [],
      error:
        "No se pudo cargar la edición personalizada. Comprueba la conexión y reintenta.",
    };
  }
}

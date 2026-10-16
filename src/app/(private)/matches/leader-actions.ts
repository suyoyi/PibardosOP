"use server";
import { requireUser } from "@/lib/supabase/server";
import { getCatalog } from "@/lib/data";
import { publicCatalog } from "@/lib/public-catalog";
import { matchLeaderChoices } from "@/domain/match-leaders";

export async function getMatchLeaderChoices() {
  const { supabase } = await requireUser();
  try {
    const [saved, source] = await Promise.all([
      getCatalog(supabase),
      publicCatalog(),
    ]);
    return {
      choices: matchLeaderChoices(saved, source.result.cards),
      issues: source.result.issues,
    };
  } catch {
    return {
      error:
        "No se pudo actualizar la lista de líderes. Puedes usar los líderes guardados o volver a intentarlo.",
    };
  }
}

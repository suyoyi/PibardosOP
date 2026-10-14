import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "./supabase/server";
import { getDeckWorkspace } from "./data";
import { uuid } from "@/domain/forms";
export async function loadDeck(id: string) {
  if (!uuid.safeParse(id).success) notFound();
  const { supabase } = await requireUser(),
    workspace = await getDeckWorkspace(supabase),
    deck = workspace.decks.find((d) => d.id === id);
  if (!deck) notFound();
  return {
    ...workspace,
    deck,
    deckVersions: workspace.versions.filter((v) => v.deck_id === id),
    currentEntries: workspace.entries.filter(
      (e) => e.deck_version_id === deck.current_version_id,
    ),
  };
}

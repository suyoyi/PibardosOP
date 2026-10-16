import { redirect } from "next/navigation";
import { loadDeck } from "@/lib/deck-page";
export default async function PreviousDeckPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params;
  await loadDeck(deckId);
  redirect(`/statistics/compare?a=${deckId}`);
}

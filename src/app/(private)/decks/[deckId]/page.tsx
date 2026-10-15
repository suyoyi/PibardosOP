import { loadDeck } from "@/lib/deck-page";
import { exportDecklist } from "@/domain/deck-import";
import { SavedNotice } from "@/components/forms";
import { DeckGallery } from "@/components/deck-gallery";
import { buildDeckDisplay } from "@/domain/deck-prices";
import { getDeckQuotes } from "@/lib/deck-quotes";
import { requireUser } from "@/lib/supabase/server";
export default async function DeckPage({
  params,
  searchParams,
}: {
  params: Promise<{ deckId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { deckId } = await params,
    w = await loadDeck(deckId),
    leader = w.catalog.find((c) => c.id === w.deck.leader_card_id)!;
  const { supabase } = await requireUser(),
    pricing = await getDeckQuotes(supabase, [
      w.deck.leader_card_id,
      ...w.currentEntries.map((e) => e.card_id),
    ]),
    display = buildDeckDisplay(
      w.deck.leader_card_id,
      w.currentEntries,
      w.catalog,
      pricing.quotes,
    );
  return (
    <>
      <SavedNotice saved={(await searchParams).saved} />
      <DeckGallery
        display={display}
        priceError={pricing.error}
        format={w.deck.format}
        deckId={deckId}
        name={w.deck.name}
        description={w.deck.description}
        versionId={w.deck.current_version_id!}
        exportText={exportDecklist(leader, w.currentEntries, w.catalog)}
      />
    </>
  );
}

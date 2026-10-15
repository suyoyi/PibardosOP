import { loadDeck } from "@/lib/deck-page";
import { PageHeading } from "@/components/ui";
import { DeckBuilder } from "@/components/deck-builder";
export default async function EditDeckPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params,
    w = await loadDeck(deckId);
  return (
    <>
      <PageHeading
        eyebrow="AJUSTA TU ESTRATEGIA"
        title={`Editar ${w.deck.name}`}
        description="Ajusta el nombre, el líder y las cartas de tu mazo."
      />
      <DeckBuilder
        id={deckId}
        catalog={w.catalog}
        restrictions={w.restrictions}
        deck={w.deck}
        initialEntries={w.currentEntries}
      />
    </>
  );
}

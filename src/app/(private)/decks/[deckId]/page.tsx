import Link from "next/link";
import { loadDeck } from "@/lib/deck-page";
import { validateDeck, standardRules } from "@/domain/decks";
import { exportDecklist } from "@/domain/deck-import";
import { PageHeading } from "@/components/ui";
import { SavedNotice } from "@/components/forms";
import { ValidationMessages } from "@/components/deck-builder";
import { DeckGallery } from "@/components/deck-gallery";
import { buildDeckDisplay } from "@/domain/deck-prices";
import { getDeckQuotes } from "@/lib/deck-quotes";
import { requireUser } from "@/lib/supabase/server";
import { DeckOperations } from "@/components/deck-operations";
import { DeckExport } from "@/components/deck-export";
export default async function DeckPage({
  params,
  searchParams,
}: {
  params: Promise<{ deckId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { deckId } = await params,
    w = await loadDeck(deckId),
    leader = w.catalog.find((c) => c.id === w.deck.leader_card_id),
    version = w.deckVersions.find((v) => v.id === w.deck.current_version_id),
    result = validateDeck(
      leader,
      w.currentEntries,
      w.catalog,
      w.restrictions,
      standardRules(w.deck.format),
    );
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
      <PageHeading
        eyebrow={`TU MAZO · V${version?.version_number ?? "—"}`}
        title={w.deck.name}
        description={w.deck.description || "Lista personal"}
      />
      <SavedNotice saved={(await searchParams).saved} />
      <div className="mb-6 flex flex-wrap gap-3">
        <Link href={`/collection?deck=${deckId}`} className="button-secondary">
          Cartas que me faltan
        </Link>
        <Link href={`/decks/${deckId}/edit`} className="button-primary">
          Editar mazo
        </Link>
        <Link href={`/decks/${deckId}/versions`} className="button-secondary">
          Versiones
        </Link>
        <Link href={`/decks/${deckId}/compare`} className="button-secondary">
          Comparar versiones
        </Link>
        <Link
          href={`/matches/new?version=${w.deck.current_version_id}`}
          className="button-secondary"
        >
          Registrar partida
        </Link>
      </div>
      <div className="grid gap-6">
        <DeckGallery
          display={display}
          priceError={pricing.error}
          format={w.deck.format}
          status={w.deck.status}
        />
        <ValidationMessages result={result} />
        {leader && (
          <DeckExport
            text={exportDecklist(leader, w.currentEntries, w.catalog)}
            name={w.deck.name}
          />
        )}
        <DeckOperations id={deckId} archived={w.deck.status === "archived"} />
      </div>
    </>
  );
}

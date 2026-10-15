import Link from "next/link";
import { loadDeck } from "@/lib/deck-page";
import { validateDeck, standardRules } from "@/domain/decks";
import { exportDecklist } from "@/domain/deck-import";
import { PageHeading } from "@/components/ui";
import { SavedNotice } from "@/components/forms";
import { ValidationMessages } from "@/components/deck-builder";
import { CardArtwork } from "@/components/card-catalog";
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
        {leader && (
          <section className="panel flex items-center gap-4 p-5">
            <CardArtwork card={leader} small />
            <div>
              <h2 className="font-semibold">{leader.name}</h2>
              <p className="mt-2 text-sm text-muted">
                {leader.card_number} · {w.deck.format} ·{" "}
                {w.deck.status === "draft"
                  ? "Borrador"
                  : w.deck.status === "active"
                    ? "Activo"
                    : "Archivado"}
              </p>
            </div>
          </section>
        )}
        <ValidationMessages result={result} />
        <ul className="grid gap-3 sm:grid-cols-2">
          {w.currentEntries.map((entry) => {
            const card = w.catalog.find((c) => c.id === entry.card_id);
            return (
              card && (
                <li key={card.id} className="panel flex items-center gap-3 p-4">
                  <CardArtwork card={card} small />
                  <div className="min-w-0">
                    <p className="text-xs text-accent">
                      {card.card_number} ·{" "}
                      {entry.role === "don" ? "DON!! separado" : "Principal"}
                    </p>
                    <p className="mt-1 break-words font-semibold">
                      {entry.quantity} × {card.name}
                    </p>
                  </div>
                </li>
              )
            );
          })}
        </ul>
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

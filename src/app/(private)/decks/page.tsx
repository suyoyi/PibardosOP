import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { getDeckWorkspace } from "@/lib/data";
import { PageHeading, EmptyState } from "@/components/ui";
import { SavedNotice } from "@/components/forms";
import { DeckList } from "@/components/deck-list";
export default async function DecksPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { supabase } = await requireUser(),
    w = await getDeckWorkspace(supabase);
  return (
    <>
      <PageHeading
        eyebrow="PREPARA TU ESTRATEGIA"
        title="Mazos"
        description="Crea tus mazos o importa una lista para empezar a jugar."
      />
      <SavedNotice saved={(await searchParams).saved} />
      <div className="mb-6 flex flex-wrap gap-3">
        <Link href="/decks/new" className="button-primary">
          Crear mazo
        </Link>
        <Link href="/decks/import" className="button-secondary">
          Importar mazo
        </Link>
      </div>
      {w.decks.length ? (
        <DeckList decks={w.decks} catalog={w.catalog} />
      ) : (
        <EmptyState title="Una biblioteca por construir">
          <p>
            Crea tu primer mazo, selecciona un líder y revisa la lista antes de
            guardarla.
          </p>
        </EmptyState>
      )}
    </>
  );
}

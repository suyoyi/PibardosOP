import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/supabase/server";
import { getDeckWorkspace } from "@/lib/data";
import { PageHeading, EmptyState } from "@/components/ui";
import { TournamentForm } from "@/components/tournament-form";
export default async function NewTournamentPage() {
  const { supabase } = await requireUser(),
    w = await getDeckWorkspace(supabase);
  return (
    <>
      <PageHeading
        eyebrow="TU PRÓXIMO EVENTO"
        title="Crear torneo"
        description="Elige una versión de mazo antes de registrar las rondas."
      />
      {w.versions.length ? (
        <TournamentForm
          id={randomUUID()}
          decks={w.decks}
          versions={w.versions}
          today={new Date().toISOString().slice(0, 10)}
        />
      ) : (
        <EmptyState title="Necesitas un mazo guardado">
          <Link className="button-primary mt-3" href="/decks/new">
            Crear mazo
          </Link>
        </EmptyState>
      )}
    </>
  );
}

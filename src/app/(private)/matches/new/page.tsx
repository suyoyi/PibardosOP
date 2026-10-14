import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/supabase/server";
import { getCompetitiveWorkspace } from "@/lib/data";
import { PageHeading, EmptyState } from "@/components/ui";
import { MatchForm } from "@/components/match-form";
export default async function NewMatchPage({
  searchParams,
}: {
  searchParams: Promise<{ version?: string; tournament?: string }>;
}) {
  const { supabase } = await requireUser(),
    w = await getCompetitiveWorkspace(supabase),
    q = await searchParams;
  const event = w.tournaments.find((t) => t.id === q.tournament);
  const initialVersion = w.versions.some((v) => v.id === q.version)
    ? q.version
    : undefined;
  return (
    <>
      <PageHeading
        eyebrow="CADA PARTIDA CUENTA"
        title="Registrar partida"
        description="Selecciona tu versión, el líder rival, tu salida y el resultado. El historial y las gráficas se actualizarán al guardar."
      />
      {w.versions.length ? (
        <MatchForm
          id={randomUUID()}
          decks={w.decks}
          versions={w.versions}
          catalog={w.catalog}
          tournaments={w.tournaments}
          initialVersion={initialVersion}
          initialTournament={event?.id}
          initialRound={
            event
              ? Math.max(
                  0,
                  ...w.rounds
                    .filter((r) => r.tournament_id === event.id)
                    .map((r) => r.round_number),
                ) + 1
              : undefined
          }
          now={new Date().toISOString()}
        />
      ) : (
        <EmptyState title="Primero guarda un mazo">
          <p>
            Necesitas una versión guardada para registrar la partida exacta.
          </p>
          <Link href="/decks/new" className="button-primary mt-4">
            Crear mazo
          </Link>
        </EmptyState>
      )}
      <p className="mt-5 text-sm text-muted">
        ¿Falta el líder rival?{" "}
        <Link href="/cards/new" className="text-accent underline">
          Añádelo al catálogo manual
        </Link>{" "}
        antes de completar el registro.
      </p>
    </>
  );
}

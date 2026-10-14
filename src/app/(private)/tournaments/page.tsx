import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { getCompetitiveWorkspace } from "@/lib/data";
import { summarizeResults } from "@/domain/statistics";
import { PageHeading, EmptyState } from "@/components/ui";
import { SavedNotice } from "@/components/forms";
export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { supabase } = await requireUser(),
    w = await getCompetitiveWorkspace(supabase);
  return (
    <>
      <PageHeading
        eyebrow="COMPITE Y APRENDE"
        title="Torneos"
        description="Registra el evento y sus rondas con la versión exacta que llevaste."
      />
      <SavedNotice saved={(await searchParams).saved} />
      <Link href="/tournaments/new" className="button-primary mb-6">
        Crear torneo
      </Link>
      {w.tournaments.length ? (
        <ul className="grid gap-4">
          {w.tournaments.map((t) => {
            const record = summarizeResults(
              w.matches
                .filter((m) => m.tournament_id === t.id)
                .map((m) => m.result),
            );
            return (
              <li key={t.id}>
                <Link href={`/tournaments/${t.id}`} className="panel block p-5">
                  <h2 className="break-words font-semibold">
                    {t.name}
                    {t.archived_at ? " · Archivado" : ""}
                  </h2>
                  <p className="mt-2 text-sm text-muted">
                    {new Date(`${t.event_date}T12:00:00Z`).toLocaleDateString(
                      "es-ES",
                    )}{" "}
                    · {t.location || "Sin lugar"}
                  </p>
                  <p className="mt-3 text-sm">
                    {record.wins} V · {record.losses} D · {record.totalGames}{" "}
                    partidas
                    {t.placement ? ` · Puesto ${t.placement}` : ""}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="Tu próximo evento">
          <p>Crea un torneo y registra cada ronda después de jugarla.</p>
        </EmptyState>
      )}
    </>
  );
}

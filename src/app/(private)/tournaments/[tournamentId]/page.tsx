import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { getCompetitiveWorkspace } from "@/lib/data";
import { uuid } from "@/domain/forms";
import { tournamentSummary } from "@/domain/statistics";
import { PageHeading } from "@/components/ui";
import { SavedNotice } from "@/components/forms";
import { ArchiveTournamentForm } from "@/components/destructive-forms";
export default async function TournamentPage({
  params,
  searchParams,
}: {
  params: Promise<{ tournamentId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { tournamentId } = await params;
  if (!uuid.safeParse(tournamentId).success) notFound();
  const { supabase } = await requireUser(),
    w = await getCompetitiveWorkspace(supabase),
    t = w.tournaments.find((e) => e.id === tournamentId);
  if (!t) notFound();
  const matches = w.matches.filter((m) => m.tournament_id === t.id),
    rounds = w.rounds
      .filter((r) => r.tournament_id === t.id)
      .sort((a, b) => a.round_number - b.round_number),
    record = tournamentSummary(matches, rounds),
    version = w.versions.find((v) => v.id === t.deck_version_id),
    deck = w.decks.find((d) => d.id === version?.deck_id);
  const labels = { win: "Victoria", loss: "Derrota", draw: "Empate" };
  return (
    <>
      <PageHeading
        eyebrow={t.archived_at ? "EVENTO ARCHIVADO" : "TU EVENTO"}
        title={t.name}
        description={`${t.event_date} · ${t.location || "Sin lugar"} · ${t.format}`}
      />
      <SavedNotice saved={(await searchParams).saved} />
      <div className="mb-6 flex flex-wrap gap-3">
        {!t.archived_at && (
          <Link
            href={`/matches/new?tournament=${t.id}`}
            className="button-primary"
          >
            Registrar ronda
          </Link>
        )}
        <Link href={`/tournaments/${t.id}/edit`} className="button-secondary">
          Editar torneo
        </Link>
      </div>
      <div className="grid gap-6">
        <section className="panel grid gap-3 p-5">
          <h2 className="font-semibold">Resumen del torneo</h2>
          <p>
            {record.wins} V · {record.losses} D · {record.draws} E ·{" "}
            {record.totalGames} partidas
          </p>
          <p className="text-sm text-muted">
            {record.winRate === null
              ? "Sin porcentaje de victoria"
              : `${(record.winRate * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 })}% de victorias`}{" "}
            · n={record.decisiveGames} sin empates · {record.recordedRounds}{" "}
            rondas registradas
          </p>
          <p className="text-sm">Puesto final: {t.placement ?? "Pendiente"}</p>
          {version && deck && (
            <Link
              className="text-sm text-accent underline"
              href={`/decks/${deck.id}/compare?after=${version.id}`}
            >
              {deck.name} · v{version.version_number}
            </Link>
          )}
          <p className="whitespace-pre-wrap text-sm text-muted">
            {t.notes || "Sin notas"}
          </p>
        </section>
        <section className="panel p-5">
          <h2 className="mb-4 font-semibold">Rondas</h2>
          <ol className="grid gap-4">
            {rounds.map((round) => {
              const match = matches.find((m) => m.id === round.match_id);
              return (
                match && (
                  <li
                    key={round.id}
                    className="rounded-xl border border-border p-4"
                  >
                    <h3 className="font-semibold">
                      Ronda {round.round_number} · {labels[match.result]}
                    </h3>
                    <p className="mt-2 text-sm">
                      {
                        w.catalog.find((c) => c.id === match.opponent_leader_id)
                          ?.name
                      }{" "}
                      · {match.went_first ? "Primero" : "Segundo"}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted">
                      {match.opponent_name}
                      {match.notes ? ` · ${match.notes}` : ""}
                    </p>
                    <Link
                      className="button-secondary mt-3"
                      href={`/matches/${match.id}/edit`}
                    >
                      Editar partida
                    </Link>
                  </li>
                )
              );
            })}
          </ol>
          {!rounds.length && (
            <p className="text-sm text-muted">
              Todavía no has registrado rondas.
            </p>
          )}
        </section>
        <ArchiveTournamentForm id={t.id} archived={Boolean(t.archived_at)} />
      </div>
    </>
  );
}

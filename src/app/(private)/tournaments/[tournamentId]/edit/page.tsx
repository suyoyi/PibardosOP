import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { getCompetitiveWorkspace } from "@/lib/data";
import { uuid } from "@/domain/forms";
import { PageHeading } from "@/components/ui";
import { TournamentForm } from "@/components/tournament-form";
export default async function EditTournamentPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  if (!uuid.safeParse(tournamentId).success) notFound();
  const { supabase } = await requireUser(),
    w = await getCompetitiveWorkspace(supabase),
    t = w.tournaments.find((e) => e.id === tournamentId);
  if (!t) notFound();
  return (
    <>
      <PageHeading
        eyebrow="TU EVENTO"
        title="Editar torneo"
        description="Actualiza sus datos o registra tu posición final. Archivar conserva el historial."
      />
      <TournamentForm
        id={t.id}
        decks={w.decks}
        versions={w.versions}
        initial={t}
        hasMatches={w.matches.some((m) => m.tournament_id === t.id)}
        today={new Date().toISOString().slice(0, 10)}
      />
    </>
  );
}

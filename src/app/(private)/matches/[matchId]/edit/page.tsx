import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { getCompetitiveWorkspace } from "@/lib/data";
import { uuid } from "@/domain/forms";
import { PageHeading } from "@/components/ui";
import { MatchForm } from "@/components/match-form";
import { DeleteMatchForm } from "@/components/destructive-forms";
export default async function EditMatchPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  if (!uuid.safeParse(matchId).success) notFound();
  const { supabase } = await requireUser(),
    w = await getCompetitiveWorkspace(supabase),
    match = w.matches.find((m) => m.id === matchId);
  if (!match) notFound();
  return (
    <>
      <PageHeading
        eyebrow="TU HISTORIAL"
        title="Editar partida"
        description="Corrige el resultado y los datos de la partida. Los resúmenes se calculan de nuevo al guardar."
      />
      <div className="grid gap-6">
        <MatchForm
          id={matchId}
          decks={w.decks}
          versions={w.versions}
          catalog={w.catalog}
          tournaments={w.tournaments}
          initial={match}
          initialRound={
            w.rounds.find((r) => r.match_id === matchId)?.round_number
          }
          now={new Date().toISOString()}
        />
        <DeleteMatchForm id={matchId} />
      </div>
    </>
  );
}

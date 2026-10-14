"use client";
import { deleteMatch, archiveTournament } from "@/app/(private)/actions";
import { ActionForm } from "./forms";
export function DeleteMatchForm({ id }: { id: string }) {
  return (
    <ActionForm
      action={deleteMatch}
      submit="Eliminar partida"
      confirm="¿Eliminar esta partida? Se retirará del historial, de las estadísticas y de su ronda de torneo."
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="confirmed" value="yes" />
    </ActionForm>
  );
}
export function ArchiveTournamentForm({
  id,
  archived,
}: {
  id: string;
  archived: boolean;
}) {
  return (
    <ActionForm
      action={archiveTournament}
      submit={archived ? "Restaurar torneo" : "Archivar torneo"}
      confirm={
        archived
          ? "¿Restaurar este torneo?"
          : "¿Archivar el torneo? Sus rondas y partidas se conservarán."
      }
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="confirmed" value="yes" />
      <input type="hidden" name="restore" value={archived ? "yes" : "no"} />
    </ActionForm>
  );
}

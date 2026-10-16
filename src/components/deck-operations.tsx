"use client";
import { deckOperation } from "@/app/(private)/actions";
import { ActionForm } from "./forms";
export function DeckDelete({ id }: { id: string }) {
  return (
    <ActionForm
      action={deckOperation}
      submit="Eliminar mazo"
      submitClassName="button-danger"
      className="deck-delete-form"
      confirm="¿Eliminar este mazo y sus listas guardadas? No se eliminarán partidas ni torneos vinculados; si existen, el borrado se bloqueará."
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="operation" value="delete" />
      <input type="hidden" name="confirmed" value="yes" />
    </ActionForm>
  );
}

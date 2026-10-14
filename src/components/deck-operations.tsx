"use client";
import { deckOperation } from "@/app/(private)/actions";
import { ActionForm } from "./forms";
export function DeckOperations({
  id,
  archived,
}: {
  id: string;
  archived: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {(
        [
          ["duplicate", "Duplicar mazo", undefined],
          [
            archived ? "restore" : "archive",
            archived ? "Restaurar borrador" : "Archivar mazo",
            archived
              ? undefined
              : "¿Archivar este mazo? Su historial se conservará.",
          ],
          [
            "delete",
            "Eliminar mazo",
            "¿Eliminar el mazo y sus versiones? Si tiene partidas o torneos asociados, se conservará y deberás archivarlo.",
          ],
        ] as const
      ).map(([operation, submit, confirm]) => (
        <ActionForm
          key={operation}
          action={deckOperation}
          submit={submit}
          confirm={confirm}
        >
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="operation" value={operation} />
          <input type="hidden" name="confirmed" value="yes" />
        </ActionForm>
      ))}
    </div>
  );
}

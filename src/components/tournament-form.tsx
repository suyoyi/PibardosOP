"use client";
import { useState } from "react";
import { saveTournament } from "@/app/(private)/actions";
import type { Deck, DeckVersion } from "@/domain/decks";
import type { Tournament } from "@/lib/data";
import { ActionForm, Field } from "./forms";
export function TournamentForm({
  id,
  decks,
  versions,
  initial,
  hasMatches = false,
  today,
}: {
  id: string;
  decks: Deck[];
  versions: DeckVersion[];
  initial?: Tournament;
  hasMatches?: boolean;
  today: string;
}) {
  const [versionId, setVersionId] = useState(
      initial?.deck_version_id ?? decks[0]?.current_version_id ?? "",
    ),
    version = versions.find((v) => v.id === versionId);
  return (
    <ActionForm
      action={saveTournament}
      submit={initial ? "Guardar torneo" : "Crear torneo"}
    >
      <input type="hidden" name="id" value={id} />
      <input
        type="hidden"
        name="format"
        value={version?.format ?? initial?.format ?? "standard"}
      />
      <Field label="Nombre del torneo">
        <input
          name="name"
          className="field"
          required
          maxLength={200}
          defaultValue={initial?.name ?? ""}
        />
      </Field>
      <Field label="Fecha del torneo">
        <input
          name="event_date"
          type="date"
          className="field"
          required
          defaultValue={initial?.event_date ?? today}
        />
      </Field>
      <Field label="Lugar">
        <input
          name="location"
          className="field"
          maxLength={300}
          defaultValue={initial?.location ?? ""}
        />
      </Field>
      <Field
        label="Mazo y versión del torneo"
        hint={
          hasMatches
            ? "Hay partidas registradas: esta versión se conserva."
            : "Todas las rondas utilizarán esta versión y su formato."
        }
      >
        <select
          name="deck_version_id"
          className="field"
          required
          value={versionId}
          onChange={(e) => setVersionId(e.target.value)}
        >
          {[...versions]
            .reverse()
            .filter((v) => !hasMatches || v.id === initial?.deck_version_id)
            .map((v) => (
              <option key={v.id} value={v.id}>
                {decks.find((d) => d.id === v.deck_id)?.name} · v
                {v.version_number} · {v.format}
              </option>
            ))}
          <option value="">Seleccionar versión</option>
        </select>
      </Field>
      <Field label="Posición final (opcional)">
        <input
          name="placement"
          type="number"
          min={1}
          max={100000}
          className="field"
          defaultValue={initial?.placement ?? ""}
        />
      </Field>
      <Field label="Notas del torneo">
        <textarea
          name="notes"
          className="field"
          rows={4}
          maxLength={10000}
          defaultValue={initial?.notes ?? ""}
        />
      </Field>
    </ActionForm>
  );
}

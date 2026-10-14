"use client";
import { useState } from "react";
import { saveMatch } from "@/app/(private)/actions";
import type { Deck, DeckVersion } from "@/domain/decks";
import type { Card } from "@/domain/cards";
import type { Match, Tournament } from "@/lib/data";
import { ActionForm, Field } from "./forms";
export function MatchForm({
  id,
  decks,
  versions,
  catalog,
  tournaments,
  initial,
  initialVersion,
  initialTournament,
  initialRound,
  now,
}: {
  id: string;
  decks: Deck[];
  versions: DeckVersion[];
  catalog: Card[];
  tournaments: Tournament[];
  initial?: Match;
  initialVersion?: string;
  initialTournament?: string;
  initialRound?: number;
  now: string;
}) {
  const [tournamentId, setTournamentId] = useState(
      initial?.tournament_id ?? initialTournament ?? "",
    ),
    [versionId, setVersionId] = useState(
      initial?.deck_version_id ??
        initialVersion ??
        decks.find((d) => d.status !== "archived")?.current_version_id ??
        "",
    );
  const [date, setDate] = useState((initial?.played_at ?? now).slice(0, 16));
  const tournament = tournaments.find((t) => t.id === tournamentId),
    version = versions.find(
      (v) => v.id === (tournament?.deck_version_id ?? versionId),
    );
  const displayedVersions = [...versions].sort(
    (a, b) => b.version_number - a.version_number,
  );
  return (
    <ActionForm
      action={saveMatch}
      submit={initial ? "Guardar cambios de partida" : "Guardar partida"}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="played_at" value={`${date}:00.000Z`} />
      <input
        type="hidden"
        name="format"
        value={tournament?.format ?? version?.format ?? "standard"}
      />
      <Field label="Torneo (opcional)">
        <select
          name="tournament_id"
          className="field"
          value={tournamentId}
          onChange={(e) => {
            setTournamentId(e.target.value);
            const selected = tournaments.find((t) => t.id === e.target.value);
            if (selected?.deck_version_id)
              setVersionId(selected.deck_version_id);
          }}
        >
          <option value="">Partida sin torneo</option>
          {tournaments
            .filter((t) => !t.archived_at || t.id === initial?.tournament_id)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.archived_at ? " (archivado)" : ""}
              </option>
            ))}
        </select>
      </Field>
      <Field
        label="Mazo y versión jugada"
        hint="Conservaremos esta versión aunque edites el mazo después."
      >
        <select
          name="deck_version_id"
          className="field"
          required
          value={version?.id ?? ""}
          onChange={(e) => setVersionId(e.target.value)}
          aria-readonly={Boolean(tournament)}
        >
          {displayedVersions
            .filter((v) => !tournament || v.id === tournament.deck_version_id)
            .map((v) => (
              <option key={v.id} value={v.id}>
                {decks.find((d) => d.id === v.deck_id)?.name} · v
                {v.version_number} · {v.format}
              </option>
            ))}
          <option value="">Seleccionar versión</option>
        </select>
      </Field>
      <Field label="Líder rival">
        <select
          name="opponent_leader_id"
          className="field"
          required
          defaultValue={initial?.opponent_leader_id ?? ""}
        >
          <option value="">Seleccionar líder rival</option>
          {catalog
            .filter((c) => c.card_type === "leader")
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.card_number} · {c.name}
              </option>
            ))}
        </select>
      </Field>
      <fieldset>
        <legend className="field-label">Resultado</legend>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["win", "Victoria"],
              ["loss", "Derrota"],
              ["draw", "Empate"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border p-2 text-sm has-checked:border-accent has-checked:bg-accent/10"
            >
              <input
                required
                type="radio"
                name="result"
                value={value}
                defaultChecked={initial?.result === value}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="field-label">¿Has salido primero o segundo?</legend>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["true", "Primero"],
              ["false", "Segundo"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border p-3 has-checked:border-accent has-checked:bg-accent/10"
            >
              <input
                required
                type="radio"
                name="went_first"
                value={value}
                defaultChecked={
                  initial ? String(initial.went_first) === value : false
                }
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      {tournamentId ? (
        <Field label="Número de ronda">
          <input
            type="number"
            name="round_number"
            className="field"
            min={1}
            max={999}
            required
            defaultValue={initialRound ?? 1}
          />
        </Field>
      ) : (
        <input name="round_number" type="hidden" value="" />
      )}
      <details>
        <summary className="min-h-12 cursor-pointer py-3 text-sm text-accent">
          Fecha, rival y notas
        </summary>
        <div className="mt-3 grid gap-5">
          <Field
            label="Fecha y hora (UTC)"
            hint="La fecha se registra en UTC. El historial se muestra en horario de Madrid."
          >
            <input
              type="datetime-local"
              className="field"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Tipo de partida">
            <select
              name="match_type"
              className="field"
              defaultValue={
                initial?.match_type ??
                (tournamentId ? "tournament" : "friendly")
              }
            >
              <option value="friendly">Amistosa</option>
              <option value="practice">Práctica</option>
              <option value="ranked">Competitiva</option>
              <option value="tournament">Torneo</option>
            </select>
          </Field>
          <Field label="Nombre rival (opcional)">
            <input
              name="opponent_name"
              className="field"
              maxLength={200}
              defaultValue={initial?.opponent_name ?? ""}
            />
          </Field>
          <Field label="Notas y observaciones">
            <textarea
              name="notes"
              className="field"
              rows={4}
              maxLength={10000}
              defaultValue={initial?.notes ?? ""}
            />
          </Field>
        </div>
      </details>
    </ActionForm>
  );
}

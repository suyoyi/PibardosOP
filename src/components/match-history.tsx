"use client";
import Link from "next/link";
import { useState } from "react";
import type { Match, Tournament } from "@/lib/data";
import type { Deck, DeckVersion } from "@/domain/decks";
import type { Card } from "@/domain/cards";
import { Field } from "./forms";
export const resultLabels = {
  win: "Victoria",
  loss: "Derrota",
  draw: "Resultado antiguo: revisar",
};
export function MatchHistory({
  matches,
  decks,
  versions,
  catalog,
  tournaments,
}: {
  matches: Match[];
  decks: Deck[];
  versions: DeckVersion[];
  catalog: Card[];
  tournaments: Tournament[];
}) {
  const [deckId, setDeckId] = useState(""),
    [leaderId, setLeaderId] = useState(""),
    [result, setResult] = useState(""),
    [order, setOrder] = useState(""),
    [page, setPage] = useState(0);
  const change = (set: (value: string) => void, value: string) => {
    set(value);
    setPage(0);
  };
  const filtered = matches.filter(
    (m) =>
      (!deckId ||
        versions.find((v) => v.id === m.deck_version_id)?.deck_id === deckId) &&
      (!leaderId || m.opponent_leader_id === leaderId) &&
      (!result || m.result === result) &&
      (!order || String(m.went_first) === order),
  );
  const currentPage = Math.min(
      page,
      Math.max(0, Math.ceil(filtered.length / 20) - 1),
    ),
    visible = filtered.slice(currentPage * 20, currentPage * 20 + 20);
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Filtrar por mazo">
          <select
            className="field"
            value={deckId}
            onChange={(e) => change(setDeckId, e.target.value)}
          >
            <option value="">Todos los mazos</option>
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Filtrar por líder rival">
          <select
            className="field"
            value={leaderId}
            onChange={(e) => change(setLeaderId, e.target.value)}
          >
            <option value="">Todos los líderes</option>
            {catalog
              .filter((c) => c.card_type === "leader")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.card_number}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Filtrar por resultado">
          <select
            className="field"
            value={result}
            onChange={(e) => change(setResult, e.target.value)}
          >
            <option value="">Todos los resultados</option>
            {Object.entries(resultLabels)
              .filter(([value]) => value !== "draw")
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Filtrar por salida">
          <select
            className="field"
            value={order}
            onChange={(e) => change(setOrder, e.target.value)}
          >
            <option value="">Ambas</option>
            <option value="true">Primero</option>
            <option value="false">Segundo</option>
          </select>
        </Field>
      </div>
      <p className="text-sm text-muted">
        {filtered.length} partidas en este historial · mostrando{" "}
        {visible.length}.
      </p>
      <ul className="grid gap-3">
        {visible.map((match) => {
          const version = versions.find((v) => v.id === match.deck_version_id),
            deck = decks.find((d) => d.id === version?.deck_id),
            opponent = catalog.find((c) => c.id === match.opponent_leader_id);
          return (
            <li key={match.id} className="panel p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2
                  className={`font-semibold ${match.result === "win" ? "text-green-200" : match.result === "loss" ? "text-red-200" : "text-blue-200"}`}
                >
                  {resultLabels[match.result]}
                </h2>
                <time dateTime={match.played_at} className="text-xs text-muted">
                  {new Date(match.played_at).toLocaleString("es-ES", {
                    timeZone: "Europe/Madrid",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
              </div>
              <p className="mt-3 break-words text-sm">
                {deck?.name} · v{version?.version_number} ·{" "}
                {match.went_first ? "Primero" : "Segundo"}
              </p>
              <p className="mt-2 break-words text-sm text-muted">
                Rival: {opponent?.name} ({opponent?.card_number})
                {match.opponent_name ? ` · ${match.opponent_name}` : ""}
              </p>
              {match.tournament_id && (
                <Link
                  href={`/tournaments/${match.tournament_id}`}
                  className="mt-3 block text-sm text-accent underline"
                >
                  {tournaments.find((t) => t.id === match.tournament_id)?.name}
                </Link>
              )}
              {match.notes && (
                <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted">
                  {match.notes}
                </p>
              )}
              <Link
                href={`/matches/${match.id}/edit`}
                className="button-secondary mt-4"
              >
                Editar partida
              </Link>
            </li>
          );
        })}
      </ul>
      {!visible.length && (
        <p className="panel p-5 text-muted">
          No hay partidas con estos filtros.
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <button
          className="button-secondary"
          type="button"
          disabled={currentPage === 0}
          onClick={() => setPage(currentPage - 1)}
        >
          Anterior
        </button>
        <span className="text-xs text-muted">Página {currentPage + 1}</span>
        <button
          className="button-secondary"
          type="button"
          disabled={(currentPage + 1) * 20 >= filtered.length}
          onClick={() => setPage(currentPage + 1)}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

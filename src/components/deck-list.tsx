"use client";
import Link from "next/link";
import { useState } from "react";
import type { Card } from "@/domain/cards";
import type { Deck, DeckVersion } from "@/domain/decks";
import { CardArtwork } from "./card-catalog";
import { Field } from "./forms";
export function DeckList({
  decks,
  catalog,
  versions,
}: {
  decks: Deck[];
  catalog: Card[];
  versions: DeckVersion[];
}) {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("current"),
    [grid, setGrid] = useState(false);
  const visible = decks.filter(
    (d) =>
      (status === "all" ||
        (status === "current"
          ? d.status !== "archived"
          : d.status === status)) &&
      `${d.name} ${d.tags.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Buscar mazo">
          <input
            className="field"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <Field label="Estado del mazo">
          <select
            className="field"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="current">Sin archivar</option>
            <option value="all">Todos</option>
            <option value="draft">Borradores</option>
            <option value="active">Activos</option>
            <option value="archived">Archivados</option>
          </select>
        </Field>
        <button
          type="button"
          className="button-secondary self-end"
          onClick={() => setGrid(!grid)}
        >
          {grid ? "Ver lista" : "Ver cuadrícula"}
        </button>
      </div>
      <ul
        className={
          grid ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "grid gap-3"
        }
      >
        {visible.map((deck) => {
          const leader = catalog.find((c) => c.id === deck.leader_card_id),
            version = versions.find((v) => v.id === deck.current_version_id);
          return (
            <li key={deck.id}>
              <Link
                href={`/decks/${deck.id}`}
                className={`panel flex h-full gap-4 p-5 ${grid ? "flex-col" : "items-center"}`}
              >
                {leader && <CardArtwork card={leader} small={!grid} />}
                <div className="min-w-0">
                  <h2 className="break-words font-semibold">{deck.name}</h2>
                  <p className="mt-2 text-sm text-muted">
                    {leader?.name} · v{version?.version_number ?? "—"} ·{" "}
                    {deck.status === "draft"
                      ? "Borrador"
                      : deck.status === "active"
                        ? "Activo"
                        : "Archivado"}
                  </p>
                  <p className="mt-2 break-words text-sm text-muted">
                    {deck.description || "Sin descripción"}
                  </p>
                  {deck.tags.length > 0 && (
                    <p className="mt-2 text-xs text-accent">
                      {deck.tags.join(" · ")}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {!visible.length && (
        <p className="panel p-5 text-muted">No hay mazos con estos filtros.</p>
      )}
    </div>
  );
}

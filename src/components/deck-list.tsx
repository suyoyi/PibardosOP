"use client";
import Link from "next/link";
import { useState } from "react";
import type { Card } from "@/domain/cards";
import type { Deck } from "@/domain/decks";
import { CardArtwork } from "./card-catalog";
import { Field } from "./forms";
export function DeckList({
  decks,
  catalog,
}: {
  decks: Deck[];
  catalog: Card[];
}) {
  const [search, setSearch] = useState(""),
    [grid, setGrid] = useState(true);
  const visible = decks.filter((d) =>
    `${d.name} ${d.tags.join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Field label="Buscar mazo">
          <input
            className="field"
            value={search}
            maxLength={120}
            onChange={(e) => setSearch(e.target.value)}
          />
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
        aria-label="Mis mazos"
        className={
          grid
            ? "grid gap-4 min-[380px]:grid-cols-2 lg:grid-cols-3"
            : "grid gap-3"
        }
      >
        {visible.map((deck) => {
          const leader = catalog.find((c) => c.id === deck.leader_card_id);
          return (
            <li key={deck.id}>
              <Link
                href={`/decks/${deck.id}`}
                className={`panel flex h-full gap-4 p-4 ${grid ? "flex-col" : "items-center"}`}
              >
                {leader && (
                  <div
                    className={
                      grid
                        ? "mx-auto aspect-[5/7] w-full max-w-[220px]"
                        : "shrink-0"
                    }
                  >
                    <CardArtwork card={leader} full={grid} small={!grid} />
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="break-words font-semibold">{deck.name}</h2>
                  <p className="mt-2 break-words text-sm text-muted">
                    {leader?.name}
                  </p>
                  {deck.description && (
                    <p className="mt-2 break-words text-sm text-muted">
                      {deck.description}
                    </p>
                  )}
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
        <p className="panel p-5 text-muted">No hay mazos con esta búsqueda.</p>
      )}
    </div>
  );
}

"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CollectionWorkspace } from "@/lib/collection";
import {
  availableQuantity,
  reservedQuantity,
  ownedPrintingQuantity,
  wishRemaining,
  priorityLabels,
  deckCollectionNeeds,
} from "@/domain/collection";
import { filterCards, type Card } from "@/domain/cards";
import { CardArtwork } from "./card-catalog";
import { CardOwnership } from "./card-ownership";
import { ActionForm, Field } from "./forms";
import {
  reserveDeck,
  wishMissingCard,
} from "@/app/(private)/collection/actions";

export function CollectionWorkspaceView({
  workspace: w,
  wishlist = false,
  deckId,
}: {
  workspace: CollectionWorkspace;
  wishlist?: boolean;
  deckId?: string;
}) {
  const [changing, startNavigation] = useTransition();
  const [limit, setLimit] = useState(24);
  const [query, setQuery] = useState(""),
    [showCompleted, setShowCompleted] = useState(true),
    router = useRouter();
  const totalOwned = w.items.reduce((n, i) => n + i.quantity_owned, 0),
    totalReserved = w.allocations.reduce((n, a) => n + a.quantity, 0),
    totalTradeable = w.items.reduce((n, i) => n + i.quantity_tradeable, 0);
  const selected = w.decks.find((d) => d.id === deckId),
    version = w.versions.find((v) => v.id === selected?.current_version_id);
  const requirements = version
    ? [
        { card_id: version.leader_card_id, quantity: 1, role: "leader" },
        ...w.entries.filter((e) => e.deck_version_id === version.id),
      ]
    : [];
  const needs = selected
    ? deckCollectionNeeds(
        selected.id,
        requirements,
        w.catalog,
        w.items,
        w.allocations,
      )
    : [];
  const staleReservations = selected
    ? w.allocations
        .filter((a) => a.deck_id === selected.id)
        .reduce((n, a) => n + a.quantity, 0) -
      needs.reduce((n, r) => n + r.reserved, 0)
    : 0;
  const inventoryIds = new Set(w.items.map((i) => i.card_id));
  const cards = filterCards(
    w.catalog.filter((c) =>
      wishlist
        ? w.wishes.some(
            (wish) =>
              wish.card_id === c.id &&
              (showCompleted || wishRemaining(wish, w.items) > 0),
          )
        : inventoryIds.has(c.id),
    ),
    { search: query },
  ).sort((a, b) => {
    if (wishlist) {
      const x = w.wishes.find((v) => v.card_id === a.id)!,
        y = w.wishes.find((v) => v.card_id === b.id)!;
      const rank = { high: 0, normal: 1, low: 2 };
      return (
        Number(wishRemaining(x, w.items) === 0) -
          Number(wishRemaining(y, w.items) === 0) ||
        rank[x.priority as keyof typeof rank] -
          rank[y.priority as keyof typeof rank] ||
        a.name.localeCompare(b.name)
      );
    }
    return (
      a.card_number.localeCompare(b.card_number) || a.name.localeCompare(b.name)
    );
  });
  function editor(card: Card) {
    const items = w.items.filter((i) => i.card_id === card.id),
      ids = new Set(items.map((i) => i.id));
    return (
      <CardOwnership
        reference={{ kind: "saved", id: card.id }}
        initialState={{
          cardId: card.id,
          items,
          allocations: w.allocations.filter((a) =>
            ids.has(a.collection_item_id),
          ),
          wish: w.wishes.find((v) => v.card_id === card.id) ?? null,
        }}
      />
    );
  }
  return (
    <div className="grid gap-6">
      <nav aria-label="Colección y deseos" className="flex flex-wrap gap-3">
        <Link
          className={wishlist ? "button-secondary" : "button-primary"}
          href="/collection"
        >
          Mi colección
        </Link>
        <Link
          className={wishlist ? "button-primary" : "button-secondary"}
          href="/wishlist"
        >
          Lista de deseos
        </Link>
        <Link className="button-secondary" href="/cards">
          Buscar cartas y artes
        </Link>
      </nav>
      <section
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        aria-label="Resumen de colección"
      >
        {[
          ["Copias físicas", totalOwned],
          ["Reservadas", totalReserved],
          ["Para intercambio", totalTradeable],
          ["Libres", Math.max(0, totalOwned - totalReserved - totalTradeable)],
        ].map(([label, value]) => (
          <div key={label} className="panel min-w-0 p-4">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </section>
      {!wishlist && (
        <section
          className="panel grid gap-5 p-4 sm:p-5"
          aria-label="Cartas que faltan para el mazo"
        >
          <h2 className="text-lg font-semibold">Completar un mazo físico</h2>
          {changing && (
            <p role="status" className="text-sm text-muted">
              Cargando el mazo físico…
            </p>
          )}
          <fieldset disabled={changing} className="grid min-w-0 gap-5">
            {w.decks.length ? (
              <>
                <Field label="Mazo físico">
                  <select
                    className="field"
                    value={selected?.id ?? ""}
                    onChange={(e) => {
                      const target = e.target.value;
                      startNavigation(() =>
                        router.push(`/collection?deck=${target}`),
                      );
                    }}
                  >
                    <option value="">Seleccionar mazo</option>
                    {w.decks.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                        {d.status === "archived" ? " · archivado" : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                {selected && version && (
                  <>
                    <p className="text-sm text-muted">
                      Versión {version.version_number} · Faltan{" "}
                      {needs.reduce((n, r) => n + r.missing, 0)} copias. Se
                      aceptan otros artes y reimpresiones de la misma identidad.
                      Solo copias en inglés; se excluyen las de intercambio y
                      las reservadas a otros mazos.
                    </p>
                    <p className="text-xs leading-5 text-muted">
                      La disponibilidad se calcula para este mazo. Reserva sus
                      copias para que no se cuenten como libres para otro.
                      Cambiar la lista virtual conserva las reservas hasta que
                      las ajustes o liberes.
                    </p>
                    {(staleReservations > 0 ||
                      needs.some((n) => n.surplus > 0)) && (
                      <p className="text-sm text-amber-100">
                        Hay reservas que sobran para esta versión. Ajustarlas
                        liberará ese exceso.
                      </p>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <ActionForm
                        key={`reserve-${selected.id}-${version.id}`}
                        action={reserveDeck}
                        submit="Reservar copias disponibles"
                        className="grid gap-3"
                      >
                        <input
                          type="hidden"
                          name="deck_id"
                          value={selected.id}
                        />
                        <input
                          type="hidden"
                          name="version_id"
                          value={version.id}
                        />
                        <p className="text-xs text-muted">
                          Ajusta las reservas a esta versión y libera las que
                          sobren. Si faltan cartas, solo reserva las
                          disponibles.
                        </p>
                      </ActionForm>
                      <ActionForm
                        key={`release-${selected.id}-${version.id}`}
                        action={reserveDeck}
                        submit="Liberar reservas del mazo"
                        className="grid gap-3"
                        confirm="¿Liberar las reservas físicas de este mazo? Las copias seguirán en tu colección."
                      >
                        <input
                          type="hidden"
                          name="deck_id"
                          value={selected.id}
                        />
                        <input
                          type="hidden"
                          name="version_id"
                          value={version.id}
                        />
                        <input type="hidden" name="release" value="yes" />
                        <input type="hidden" name="confirmed" value="yes" />
                      </ActionForm>
                    </div>
                    <ul className="grid gap-3">
                      {needs.map((need) => (
                        <li
                          key={need.key}
                          className="rounded-xl border border-border p-3"
                          aria-label={`Necesidades ${need.card.card_number}`}
                        >
                          <div className="flex items-center gap-3">
                            <CardArtwork card={need.card} small />
                            <div className="min-w-0">
                              <p className="break-words font-semibold">
                                {need.card.name}
                              </p>
                              <p className="mt-1 text-xs text-muted">
                                {need.card.card_number} ·{" "}
                                {need.roles.includes("leader")
                                  ? "Líder"
                                  : need.roles.includes("don")
                                    ? "DON!! separado"
                                    : "Principal"}
                              </p>
                              <p className="mt-2 text-sm">
                                Necesitas {need.required} · Reservadas{" "}
                                {need.reserved} · Libres {need.free} ·{" "}
                                <strong
                                  className={
                                    need.missing
                                      ? "text-accent"
                                      : "text-green-200"
                                  }
                                >
                                  Faltan {need.missing}
                                </strong>
                              </p>
                            </div>
                          </div>
                          {need.missing > 0 && (
                            <ActionForm
                              key={`wish-${selected.id}-${version.id}-${need.card.id}`}
                              action={wishMissingCard}
                              submit={`Añadir faltantes ${need.card.card_number} a deseos`}
                              className="mt-3 grid gap-3"
                            >
                              <input
                                type="hidden"
                                name="deck_id"
                                value={selected.id}
                              />
                              <input
                                type="hidden"
                                name="version_id"
                                value={version.id}
                              />
                              <input
                                type="hidden"
                                name="card_id"
                                value={need.card.id}
                              />
                              <p className="text-xs text-muted">
                                Deseo para el arte de la lista. Mantiene los
                                objetivos mayores y las notas existentes.
                              </p>
                            </ActionForm>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            ) : (
              <div className="grid gap-3">
                <p className="text-sm text-muted">
                  Guarda un mazo para consultar sus faltantes y reservar copias.
                </p>
                <Link
                  href="/decks/new"
                  className="button-secondary justify-self-start"
                >
                  Crear mazo
                </Link>
              </div>
            )}
          </fieldset>
        </section>
      )}
      <section
        className="grid gap-4"
        aria-label={wishlist ? "Mis deseos" : "Mis cartas físicas"}
      >
        <h2 className="text-lg font-semibold">
          {wishlist ? "Mis deseos" : "Mis cartas físicas"}
        </h2>
        <Field label={wishlist ? "Buscar en deseos" : "Buscar en mi colección"}>
          <input
            className="field"
            value={query}
            maxLength={120}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(24);
            }}
            placeholder="Nombre o número de carta"
          />
        </Field>
        {wishlist && (
          <label className="flex min-h-12 items-center gap-3">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => {
                setShowCompleted(e.target.checked);
                setLimit(24);
              }}
            />
            Mostrar objetivos completados
          </label>
        )}
        {cards.length ? (
          <ul className="grid gap-4 lg:grid-cols-2">
            {cards.slice(0, limit).map((card) => {
              const items = w.items.filter((i) => i.card_id === card.id),
                wish = w.wishes.find((v) => v.card_id === card.id),
                remaining = wish ? wishRemaining(wish, w.items) : 0;
              return (
                <li
                  key={card.id}
                  className="panel grid min-w-0 content-start gap-4 p-4"
                  aria-label={`Impresión ${card.card_number} ${card.printing_code}`}
                >
                  <div className="flex items-center gap-3">
                    <CardArtwork card={card} small />
                    <div className="min-w-0">
                      <p className="break-words font-semibold">{card.name}</p>
                      <p className="mt-1 break-words text-xs text-muted">
                        {card.card_number} · {card.printing_code}
                      </p>
                    </div>
                  </div>
                  {wishlist && wish ? (
                    <>
                      <p className="text-sm">
                        Prioridad{" "}
                        {
                          priorityLabels[
                            wish.priority as keyof typeof priorityLabels
                          ]
                        }{" "}
                        · Objetivo {wish.target_quantity} · Tienes{" "}
                        {ownedPrintingQuantity(card.id, w.items)} ·{" "}
                        <strong
                          className={
                            remaining ? "text-accent" : "text-green-200"
                          }
                        >
                          {remaining
                            ? `Faltan ${remaining}`
                            : "Objetivo completado"}
                        </strong>
                      </p>
                      {wish.notes && (
                        <p className="whitespace-pre-wrap break-words text-sm text-muted">
                          {wish.notes}
                        </p>
                      )}
                    </>
                  ) : (
                    <ul className="grid gap-2 text-xs text-muted">
                      {items.map((item) => (
                        <li key={item.id} className="break-words">
                          {item.storage_location || "Sin ubicación"} ·{" "}
                          {item.finish} · {item.language.toUpperCase()} · Tienes{" "}
                          {item.quantity_owned} · Intercambio{" "}
                          {item.quantity_tradeable} · Reservadas{" "}
                          {reservedQuantity(item.id, w.allocations)} · Libres{" "}
                          {availableQuantity(item, w.allocations)}
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link
                    href={`/cards/${card.id}`}
                    className="text-sm text-accent underline"
                  >
                    Ver detalle y precio de esta impresión
                  </Link>
                  {editor(card)}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="panel grid gap-3 p-6">
            <p className="font-semibold">
              {query
                ? "No hay coincidencias"
                : wishlist
                  ? "Tu lista de deseos está vacía"
                  : "Todavía no has registrado copias físicas"}
            </p>
            <p className="text-sm text-muted">
              Busca una carta o su arte en Cartas y abre «Colección y deseos»
              para añadirlo.
            </p>
            <Link href="/cards" className="button-secondary justify-self-start">
              Explorar cartas
            </Link>
          </div>
        )}
        {limit < cards.length && (
          <button
            type="button"
            className="button-secondary justify-self-start"
            onClick={() => setLimit(limit + 24)}
          >
            Mostrar más cartas
          </button>
        )}
      </section>
    </div>
  );
}

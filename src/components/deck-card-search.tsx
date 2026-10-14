"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  searchOptcg,
  getOptcgBuilderCard,
} from "@/app/(private)/cards/optcg-actions";
import {
  filterCards,
  type Card,
  type CardFilters,
  type CatalogFilterCard,
  typeLabels,
} from "@/domain/cards";
import type { OptcgCard, OptcgFamily } from "@/domain/optcg";
import { CatalogControls } from "./card-catalog";
import { Field } from "./forms";
type SearchResult = Awaited<ReturnType<typeof searchOptcg>>;
export function DeckCardSearch({
  catalog,
  filters,
  onFilters,
  onSelect,
}: {
  catalog: Card[];
  filters: CardFilters;
  onFilters: (filters: CardFilters) => void;
  onSelect: (card: Card) => void;
}) {
  const [family, setFamily] = useState<OptcgFamily>("sets"),
    [remote, setRemote] = useState<{ key: string; result: SearchResult }>(),
    [pending, startSearch] = useTransition(),
    [adding, startAdd] = useTransition(),
    [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const query = (filters.search ?? "").trim(),
    key = `${family}:${query}`;
  useEffect(() => {
    if (query.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(
      () =>
        startSearch(async () => {
          try {
            const result = await searchOptcg(query, family);
            if (!cancelled) setRemote({ key: `${family}:${query}`, result });
          } catch {
            if (!cancelled)
              setRemote({
                key: `${family}:${query}`,
                result: {
                  error:
                    "No se pudo completar la búsqueda. Revisa la conexión; tus cambios permanecen en el editor.",
                },
              });
          }
        }),
      500,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, family]);
  const result = remote?.key === key ? remote.result : undefined,
    received = result?.cards ?? [];
  const options: CatalogFilterCard[] = [...catalog, ...received];
  const saved = filterCards(catalog, filters),
    savedIds = new Set(catalog.map((c) => c.provider_card_id).filter(Boolean));
  const available = filterCards(received, filters).filter(
    (c) => !savedIds.has(c.external_id),
  );
  const choose = (card: OptcgCard) =>
    startAdd(async () => {
      setMessage({});
      let result: Awaited<ReturnType<typeof getOptcgBuilderCard>>;
      try {
        result = await getOptcgBuilderCard({
          external_id: card.external_id,
          card_number: card.card_number,
          family: card.family,
        });
      } catch {
        setMessage({
          error:
            "No se pudo añadir la carta. Revisa la conexión; el editor se conserva.",
        });
        return;
      }
      if (result.error || !result.card) {
        setMessage({
          error: result.error ?? "No se pudo añadir la carta. Reintenta.",
        });
        return;
      }
      onSelect(result.card);
      setMessage({
        success:
          result.card.card_type === "leader"
            ? "Líder seleccionado."
            : "Carta añadida al editor.",
      });
    });
  const label = (c: CatalogFilterCard) =>
    `${c.card_type === "leader" ? "Elegir líder" : "Añadir"} ${c.card_number} · ${c.name}`;
  return (
    <section
      className="panel grid gap-5 p-5"
      aria-label="Buscar cartas para el mazo"
    >
      <h2 className="text-lg font-semibold">Buscar cartas y líder</h2>
      <p className="text-sm text-muted">
        Escribe un código o nombre: aparecen tus cartas y las del proveedor
        automáticamente. Puedes añadir cartas o elegir tu líder aquí. El mazo se
        guarda cuando pulses Guardar mazo.
      </p>
      <CatalogControls
        catalog={options}
        filters={filters}
        onChange={onFilters}
      />
      <Field label="Grupo del proveedor">
        <select
          className="field"
          value={family}
          onChange={(e) => setFamily(e.target.value as OptcgFamily)}
        >
          <option value="sets">
            Sets (códigos ST y P detectados automáticamente)
          </option>
          <option value="decks">Mazos iniciales</option>
          <option value="promos">Promos y reimpresiones</option>
          <option value="don">DON!!</option>
        </select>
      </Field>
      {query.length < 2 ? (
        <p className="text-xs text-muted">
          Escribe al menos 2 caracteres para buscar cartas del proveedor.
        </p>
      ) : (
        (pending || !result) && (
          <p role="status" className="text-sm text-muted">
            Buscando cartas…
          </p>
        )
      )}
      {result?.error && (
        <p role="alert" className="text-sm text-red-200">
          {result.error} Tus cartas guardadas siguen disponibles.
        </p>
      )}
      {Boolean(result?.issues?.length) && (
        <details>
          <summary className="min-h-12 cursor-pointer py-3 text-sm text-amber-100">
            Avisos de cartas recibidas ({result!.issues!.length})
          </summary>
          <ul className="grid gap-2 text-sm text-amber-100">
            {result!.issues!.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </details>
      )}
      {message.error && (
        <p role="alert" className="text-sm text-red-200">
          {message.error}
        </p>
      )}
      {message.success && (
        <p role="status" className="text-sm text-accent">
          {message.success}
        </p>
      )}
      <p className="text-sm text-muted">
        {saved.length} cartas guardadas y {available.length} impresiones
        adicionales con estos filtros. Se muestran hasta 40 de cada grupo; afina
        la búsqueda para localizar más.
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {saved.slice(0, 40).map((card) => (
          <li
            key={card.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
          >
            <div className="min-w-0">
              <p className="text-xs text-accent">
                {card.card_number} · {typeLabels[card.card_type]}
              </p>
              <p className="break-words text-sm">
                {card.name} · {card.printing_code}
              </p>
            </div>
            <button
              type="button"
              className="button-secondary shrink-0"
              disabled={adding}
              aria-label={label(card)}
              onClick={() => {
                onSelect(card);
                setMessage({
                  success:
                    card.card_type === "leader"
                      ? "Líder seleccionado."
                      : "Carta añadida al editor.",
                });
              }}
            >
              {card.card_type === "leader" ? "Elegir líder" : "Añadir"}
            </button>
          </li>
        ))}
        {available.slice(0, 40).map((card) => (
          <li
            key={card.external_id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
          >
            <div className="min-w-0">
              <p className="text-xs text-accent">
                {card.card_number} · {typeLabels[card.card_type]}
              </p>
              <p className="break-words text-sm">
                {card.name} · {card.variant}
              </p>
            </div>
            <button
              type="button"
              className="button-secondary shrink-0"
              disabled={adding}
              aria-label={label(card)}
              onClick={() => choose(card)}
            >
              {adding
                ? "Añadiendo…"
                : card.card_type === "leader"
                  ? "Elegir líder"
                  : "Añadir"}
            </button>
          </li>
        ))}
      </ul>
      {!saved.length && !available.length && result && !result.error && (
        <p className="text-sm text-muted">
          No hay coincidencias con estos filtros. Cambia la búsqueda o crea una
          carta manual.
        </p>
      )}
      <Link
        href="/cards/new"
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-accent underline"
      >
        Crear carta manual que falta
      </Link>
    </section>
  );
}

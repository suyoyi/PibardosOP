"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  filterCards,
  colorLabels,
  typeLabels,
  type Card,
  type CardFilters,
  type CatalogFilterCard,
} from "@/domain/cards";
import { Field } from "./forms";
export function CardArtwork({
  card,
  small = false,
  full = false,
}: {
  card: Card;
  small?: boolean;
  full?: boolean;
}) {
  const imageUrl = ["berrywallet", "optcgapi"].includes(card.source)
    ? `/api/cards/${card.id}/image`
    : card.image_url;
  return (
    <CardPicture
      src={imageUrl}
      name={card.name}
      number={card.card_number}
      small={small}
      full={full}
    />
  );
}
export function CardPicture({
  src,
  name,
  number,
  small = false,
  full = false,
}: {
  src: string | null;
  name: string;
  number: string;
  small?: boolean;
  full?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <Image
      unoptimized
      src={src}
      alt={`Ilustración de ${name}`}
      width={small ? 60 : 180}
      height={small ? 84 : 252}
      loading="lazy"
      onError={() => setFailed(true)}
      className={
        full
          ? "h-full w-full object-contain"
          : small
            ? "h-20 w-14 shrink-0 rounded-md object-contain"
            : "mx-auto h-44 w-full rounded-lg object-contain"
      }
    />
  ) : (
    <div
      aria-label={`Sin ilustración de ${name}`}
      className={`flex items-center justify-center rounded-lg border border-border bg-background p-2 text-center text-xs text-muted ${full ? "h-full w-full" : small ? "h-20 w-14 shrink-0" : "h-44"}`}
    >
      <span>
        {number}
        <span className="mt-2 block text-[10px]">Sin imagen disponible</span>
      </span>
    </div>
  );
}
export function CatalogControls({
  catalog,
  filters,
  onChange,
  hideSearch = false,
}: {
  catalog: readonly CatalogFilterCard[];
  filters: CardFilters;
  onChange: (filters: CardFilters) => void;
  hideSearch?: boolean;
}) {
  const update = (key: keyof CardFilters, value: string) =>
    onChange({ ...filters, [key]: value });
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {!hideSearch && (
        <Field label="Buscar carta">
          <input
            className="field"
            value={filters.search ?? ""}
            onChange={(e) => update("search", e.target.value)}
            placeholder="Código o nombre"
            maxLength={120}
          />
        </Field>
      )}
      <Field label="Color">
        <select
          className="field"
          value={filters.color ?? ""}
          onChange={(e) => update("color", e.target.value)}
        >
          <option value="">Todos</option>
          {Object.entries(colorLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tipo">
        <select
          className="field"
          value={filters.type ?? ""}
          onChange={(e) => update("type", e.target.value)}
        >
          <option value="">Todos</option>
          {Object.entries(typeLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      {(
        [
          ["set", "Colección", catalog.map((c) => c.set_code)],
          ["cost", "Coste", catalog.map((c) => c.cost)],
          ["power", "Poder", catalog.map((c) => c.power)],
          ["counter", "Counter", catalog.map((c) => c.counter)],
          ["attribute", "Atributo", catalog.map((c) => c.attribute)],
        ] as const
      ).map(([key, label, values]) => (
        <Field key={key} label={label}>
          <select
            className="field"
            value={filters[key] ?? ""}
            onChange={(e) => update(key, e.target.value)}
          >
            <option value="">Todos</option>
            {[
              ...new Set([
                ...values.filter((v) => v !== null && v !== "").map(String),
                ...(filters[key] ? [filters[key]!] : []),
              ]),
            ]
              .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
              .map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
          </select>
        </Field>
      ))}
    </div>
  );
}
export function CardCatalog({ catalog }: { catalog: Card[] }) {
  const [filters, setFilters] = useState<CardFilters>({}),
    [grid, setGrid] = useState(true);
  const filtered = filterCards(catalog, filters);
  return (
    <div className="grid gap-6">
      <CatalogControls
        catalog={catalog}
        filters={filters}
        onChange={setFilters}
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {filtered.length} cartas · los datos manuales no están verificados.
        </p>
        <button
          type="button"
          className="button-secondary"
          onClick={() => setGrid(!grid)}
        >
          {grid ? "Ver lista" : "Ver cuadrícula"}
        </button>
      </div>
      {filtered.length ? (
        <ul
          className={
            grid
              ? "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4"
              : "grid gap-3"
          }
        >
          {filtered.map((card) => (
            <li key={card.id}>
              <Link
                href={`/cards/${card.id}`}
                className={`panel flex h-full gap-3 p-4 ${grid ? "flex-col" : "items-center"}`}
              >
                <CardArtwork card={card} small={!grid} />
                <div className="min-w-0">
                  <span className="text-xs text-accent">
                    {card.card_number}
                  </span>
                  <h2 className="mt-1 break-words font-semibold">
                    {card.name}
                  </h2>
                  <p className="mt-2 text-xs text-muted">
                    {typeLabels[card.card_type]} ·{" "}
                    {card.colors.map((c) => colorLabels[c]).join(" / ") ||
                      "Sin colores"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {card.source === "manual"
                      ? "Manual · sin verificar"
                      : card.source}{" "}
                    · {card.printing_code}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="panel p-6 text-muted">
          No hay cartas que coincidan. Cambia los filtros o vuelve a consultar
          el proveedor.
        </p>
      )}
    </div>
  );
}

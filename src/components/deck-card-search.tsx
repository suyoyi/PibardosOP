"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Check, Minus, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import {
  searchOptcg,
  browseOptcg,
  getOptcgBuilderCard,
} from "@/app/(private)/cards/optcg-actions";
import {
  filterCards,
  type Card,
  type CardFilters,
  type CatalogFilterCard,
} from "@/domain/cards";
import type { DeckEntry } from "@/domain/deck-import";
import type { OptcgCard, OptcgFamily } from "@/domain/optcg";
import { CardArtwork, CardPicture, CatalogControls } from "./card-catalog";
import { Field } from "./forms";
type SearchResult = Awaited<ReturnType<typeof searchOptcg>>;
type Candidate =
  { kind: "saved"; card: Card } | { kind: "remote"; card: OptcgCard };
export function DeckCardSearch({
  catalog,
  filters,
  onFilters,
  onSelect,
  onAdjust,
  entries,
  leaderId,
  mainCount,
  donCount,
}: {
  catalog: Card[];
  filters: CardFilters;
  onFilters: (filters: CardFilters) => void;
  onSelect: (card: Card) => void;
  onAdjust: (card: Card, delta: number) => void;
  entries: DeckEntry[];
  leaderId: string;
  mainCount: number;
  donCount: number;
}) {
  const [mode, setMode] = useState<"leader" | "cards">(
      leaderId ? "cards" : "leader",
    ),
    [family, setFamily] = useState<OptcgFamily>("sets"),
    [collection, setCollection] = useState("OP01"),
    [showFilters, setShowFilters] = useState(false),
    [remote, setRemote] = useState<{ key: string; result: SearchResult }>(),
    [pending, startSearch] = useTransition(),
    [adding, startAdd] = useTransition(),
    [message, setMessage] = useState<{ error?: string; success?: string }>({}),
    [pageState, setPageState] = useState<{ key: string; page: number }>();
  const query = (filters.search ?? "").trim(),
    key =
      query.length >= 2
        ? `${family}:${query}`
        : `browse:${mode}:${family}:${collection}`;
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(
      () =>
        startSearch(async () => {
          try {
            const result =
              query.length >= 2
                ? await searchOptcg(query, family)
                : await browseOptcg(mode, family, collection);
            if (!cancelled) setRemote({ key, result });
          } catch {
            if (!cancelled)
              setRemote({
                key,
                result: {
                  error:
                    "No se pudo completar la búsqueda. Tus cambios permanecen en el editor.",
                },
              });
          }
        }),
      query.length >= 2 ? 500 : 100,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, family, mode, collection, key]);
  const result = remote?.key === key ? remote.result : undefined,
    received = result?.cards ?? [];
  const english = catalog.filter((c) => c.language === "en"),
    options: CatalogFilterCard[] = [...english, ...received];
  const effective = {
    ...filters,
    type: mode === "leader" ? "leader" : filters.type,
  };
  const saved = filterCards(english, effective).filter(
      (c) => mode === "leader" || c.card_type !== "leader",
    ),
    savedIds = new Set(english.map((c) => c.provider_card_id).filter(Boolean));
  const available = filterCards(received, effective).filter(
    (c) =>
      (mode === "leader" || c.card_type !== "leader") &&
      !savedIds.has(c.external_id),
  );
  const candidates: Candidate[] = [
    ...saved.map((card) => ({ kind: "saved" as const, card })),
    ...available.map((card) => ({ kind: "remote" as const, card })),
  ];
  candidates.sort(
    (a, b) =>
      a.card.card_number.localeCompare(b.card.card_number) ||
      a.card.name.localeCompare(b.card.name),
  );
  const pageKey = `${key}:${mode}:${JSON.stringify(filters)}`,
    page = pageState?.key === pageKey ? pageState.page : 1,
    pageSize = 24;
  const showPage = Math.min(
    page,
    Math.max(1, Math.ceil(candidates.length / pageSize)),
  );
  const switchMode = (next: "leader" | "cards") => {
    setMode(next);
    onFilters({ ...filters, type: undefined, search: "" });
    setMessage({});
  };
  const accept = (card: Card, delta: number) => {
    if (card.card_type === "leader") {
      onSelect(card);
      switchMode("cards");
      setMessage({
        success: "Líder seleccionado. Añade ahora las cartas de tu mazo.",
      });
    } else {
      onAdjust(card, delta);
      setMessage({
        success:
          delta > 0 ? "Carta añadida al editor." : "Cantidad actualizada.",
      });
    }
  };
  const choose = (item: Candidate, delta: number) => {
    if (item.kind === "saved") {
      accept(item.card, delta);
      return;
    }
    startAdd(async () => {
      setMessage({});
      let result: Awaited<ReturnType<typeof getOptcgBuilderCard>>;
      try {
        result = await getOptcgBuilderCard({
          external_id: item.card.external_id,
          card_number: item.card.card_number,
          family: item.card.family,
        });
      } catch {
        setMessage({
          error:
            "No se pudo añadir la carta. Revisa la conexión; el editor se conserva.",
        });
        return;
      }
      if (result.error || !result.card) {
        setMessage({ error: result.error ?? "No se pudo añadir la carta." });
        return;
      }
      accept(result.card, delta);
    });
  };
  return (
    <section
      className="visual-picker panel overflow-clip"
      aria-label="Buscar cartas para el mazo"
    >
      <div
        className={`visual-picker-header ${showFilters ? "visual-picker-header-open" : ""}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">CONSTRUCTOR · CARTAS EN INGLÉS</p>
            <h2 className="mt-1 text-xl font-bold">
              {mode === "leader" ? "Elige tu líder" : "Busca tus cartas"}
            </h2>
          </div>
          <button
            type="button"
            className="picker-icon-button"
            aria-label="Mostrar filtros"
            aria-expanded={showFilters}
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal size={20} />
          </button>
        </div>
        <div
          className="mt-4 flex gap-2"
          role="group"
          aria-label="Tipo de búsqueda"
        >
          <button
            type="button"
            className={`picker-tab ${mode === "leader" ? "picker-tab-active" : ""}`}
            aria-pressed={mode === "leader"}
            disabled={adding}
            onClick={() => switchMode("leader")}
          >
            Líderes
          </button>
          <button
            type="button"
            className={`picker-tab ${mode === "cards" ? "picker-tab-active" : ""}`}
            aria-pressed={mode === "cards"}
            disabled={adding}
            onClick={() => switchMode("cards")}
          >
            Cartas del mazo
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              size={18}
              className="pointer-events-none absolute top-4 left-3 text-muted"
              aria-hidden="true"
            />
            <input
              aria-label="Buscar carta"
              className="field picker-search-input"
              value={filters.search ?? ""}
              maxLength={120}
              placeholder="Nombre o código · OP01-001"
              onChange={(e) =>
                onFilters({ ...filters, search: e.target.value })
              }
            />
            {filters.search && (
              <button
                type="button"
                className="absolute top-0 right-0 flex h-12 w-11 items-center justify-center text-muted"
                aria-label="Limpiar búsqueda"
                onClick={() => onFilters({ ...filters, search: "" })}
              >
                <X size={18} />
              </button>
            )}
          </div>
          <div
            className={`picker-count ${mainCount > 50 ? "text-red-200" : ""}`}
            role="status"
            aria-label={`Contador del mazo: ${mainCount} de 50 cartas`}
          >
            <strong>
              {mainCount}
              <span className="text-muted">/50</span>
            </strong>
            <span className="text-[9px] tracking-wide text-muted">
              PRINCIPAL
            </span>
          </div>
        </div>
        {donCount > 0 && (
          <p className="mt-2 text-xs text-muted">
            DON!! separado: {donCount}/10
          </p>
        )}
        {showFilters && (
          <div className="mt-4 grid gap-4 rounded-xl border border-border p-3">
            <CatalogControls
              catalog={options}
              filters={filters}
              onChange={onFilters}
              hideSearch
            />
            <Field label="Grupo del proveedor">
              <select
                className="field"
                value={family}
                onChange={(e) => {
                  setFamily(e.target.value as OptcgFamily);
                  setCollection(e.target.value === "decks" ? "ST01" : "OP01");
                }}
              >
                <option value="sets">
                  Sets (ST y P se detectan por código)
                </option>
                <option value="decks">Mazos iniciales</option>
                <option value="promos">Promos y reimpresiones</option>
                <option value="don">DON!!</option>
              </select>
            </Field>
            <Field
              label="Colección para explorar"
              hint="Al dejar la búsqueda vacía se muestran los líderes disponibles o esta colección."
            >
              <input
                className="field"
                value={collection}
                maxLength={10}
                placeholder="OP01 o ST01"
                onChange={(e) => setCollection(e.target.value.toUpperCase())}
              />
            </Field>
            <button
              type="button"
              className="button-secondary"
              onClick={() => setShowFilters(false)}
            >
              Aplicar filtros
            </button>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted">
          <span>
            {result ? candidates.length : "…"} impresiones disponibles
            {mode === "leader" ? " · líderes" : ""}
          </span>
          {(pending || !result) && <span role="status">Buscando cartas…</span>}
        </div>
      </div>
      <div className="p-3 sm:p-4">
        {result?.error && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-red-400/30 bg-red-400/5 p-3 text-sm text-red-200"
          >
            {result.error} Tus cartas guardadas siguen disponibles.
          </p>
        )}
        {message.error && (
          <p role="alert" className="mb-3 text-sm text-red-200">
            {message.error}
          </p>
        )}
        {message.success && (
          <p role="status" className="mb-3 text-sm text-accent">
            {message.success}
          </p>
        )}
        {Boolean(result?.issues?.length) && (
          <details className="mb-4">
            <summary className="min-h-11 cursor-pointer py-3 text-sm text-amber-100">
              Avisos de cartas recibidas ({result!.issues!.length})
            </summary>
            <ul className="grid gap-2 text-sm">
              {result!.issues!.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          </details>
        )}
        {(pending || !result) && !candidates.length && (
          <div aria-hidden="true" className="picker-grid mb-4">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="aspect-[5/7] animate-pulse rounded-xl border border-border bg-background"
              />
            ))}
          </div>
        )}
        <ul className="picker-grid" aria-label="Cuadrícula de cartas">
          {candidates
            .slice((showPage - 1) * pageSize, showPage * pageSize)
            .map((item) => {
              const c = item.card,
                savedCard = item.kind === "saved" ? item.card : undefined,
                quantity = savedCard
                  ? (entries.find((e) => e.card_id === savedCard.id)
                      ?.quantity ?? 0)
                  : 0,
                selected = Boolean(savedCard && savedCard.id === leaderId),
                isLeader = c.card_type === "leader",
                name = `${c.card_number} · ${c.name}`,
                src =
                  item.kind === "remote" && item.card.image_url
                    ? `/api/cards/preview?url=${encodeURIComponent(item.card.image_url)}`
                    : null;
              return (
                <li
                  key={savedCard?.id ?? (item.card as OptcgCard).external_id}
                  className="min-w-0"
                >
                  <div
                    className={`picker-card ${selected ? "picker-card-selected" : ""}`}
                  >
                    <button
                      type="button"
                      className="absolute inset-0 h-full w-full"
                      aria-label={
                        isLeader
                          ? `Elegir líder ${name}`
                          : `Añadir tocando imagen ${name}`
                      }
                      aria-pressed={isLeader ? selected : undefined}
                      disabled={adding}
                      onClick={() => choose(item, 1)}
                    >
                      {savedCard ? (
                        <CardArtwork card={savedCard} full />
                      ) : (
                        <CardPicture
                          src={src}
                          name={c.name}
                          number={c.card_number}
                          full
                        />
                      )}
                    </button>
                    {isLeader ? (
                      selected && (
                        <span
                          className="picker-quantity"
                          aria-label="Líder seleccionado"
                        >
                          <Check size={16} />
                        </span>
                      )
                    ) : (
                      <>
                        <span
                          className="picker-quantity"
                          aria-label={`Copias ${name}: ${quantity}`}
                        >
                          {quantity}
                        </span>
                        <div className="picker-quantity-controls">
                          <button
                            type="button"
                            aria-label={`Quitar ${name}`}
                            disabled={adding || quantity === 0}
                            onClick={() => choose(item, -1)}
                          >
                            <Minus size={20} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Añadir ${name}`}
                            disabled={adding || quantity >= 50}
                            onClick={() => choose(item, 1)}
                          >
                            <Plus size={20} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="picker-caption">
                    <span>{c.card_number}</span>
                    <span className="text-[9px] text-muted">EN</span>
                  </div>
                  <p
                    className="mt-1 line-clamp-2 px-1 text-[10px] leading-4 text-muted"
                    title={c.name}
                  >
                    {c.name}
                  </p>
                </li>
              );
            })}
        </ul>
        {!candidates.length && !pending && result && !result.error && (
          <p className="py-8 text-center text-sm text-muted">
            Sin coincidencias. Cambia los filtros o busca otra carta.
          </p>
        )}
        {candidates.length > pageSize && (
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              className="button-secondary"
              disabled={showPage === 1}
              onClick={() => setPageState({ key: pageKey, page: showPage - 1 })}
            >
              Anterior
            </button>
            <span className="text-xs text-muted">
              {showPage} / {Math.ceil(candidates.length / pageSize)}
            </span>
            <button
              type="button"
              className="button-secondary"
              disabled={showPage * pageSize >= candidates.length}
              onClick={() => setPageState({ key: pageKey, page: showPage + 1 })}
            >
              Siguiente
            </button>
          </div>
        )}
        <Link
          href="/cards/new"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex min-h-11 items-center text-xs text-accent underline"
        >
          Crear carta manual que falta
        </Link>
      </div>
    </section>
  );
}

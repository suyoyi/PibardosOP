"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Check, Minus, Plus, Search, X } from "lucide-react";
import {
  searchBuilderCards,
  getBuilderExpansions,
  getOptcgBuilderCard,
} from "@/app/(private)/cards/optcg-actions";
import {
  filterCards,
  type Card,
  type CardFilters,
  colorLabels,
  type CardColor,
} from "@/domain/cards";
import type { DeckEntry } from "@/domain/deck-import";
import type { OptcgCard, OptcgExpansion } from "@/domain/optcg";
import { CardArtwork, CardPicture } from "./card-catalog";
import { Field } from "./forms";
import {
  compatibleWithLeader,
  builderMaximumQuantity,
  builderCopyCount,
} from "@/domain/deck-builder";
type SearchResult = { cards: OptcgCard[]; issues: string[]; error?: string };
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
  mode: controlledMode,
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
  mode?: "leader" | "cards";
}) {
  const [internalMode, setMode] = useState<"leader" | "cards">(
    leaderId ? "cards" : "leader",
  );
  const [showDon, setShowDon] = useState(false);
  const [expansions, setExpansions] = useState<OptcgExpansion[]>([]);
  const [expansionNotice, setExpansionNotice] = useState("");
  const [remote, setRemote] = useState<{ key: string; result: SearchResult }>();
  const [pending, startSearch] = useTransition();
  const [adding, startAdd] = useTransition();
  const [message, setMessage] = useState<{ error?: string; success?: string }>(
    {},
  );
  const [pageState, setPageState] = useState<{ key: string; page: number }>();
  const mode = controlledMode ?? internalMode;
  const leader = catalog.find((card) => card.id === leaderId);
  const leaderColorsKey = JSON.stringify(leader?.colors ?? []);
  const query = (filters.search ?? "").trim();
  const expansion = filters.set ?? "",
    color = filters.color ?? "",
    cost = filters.cost ?? "";
  const searchMode = mode === "cards" && showDon ? "don" : mode;
  const key = JSON.stringify([
    query,
    searchMode,
    expansion,
    color,
    cost,
    leaderColorsKey,
  ]);
  useEffect(() => {
    let cancelled = false;
    getBuilderExpansions()
      .then((data) => {
        if (!cancelled) {
          setExpansions(data.expansions);
          setExpansionNotice(data.issues.join(" "));
        }
      })
      .catch(() => {
        if (!cancelled)
          setExpansionNotice(
            "No se pudieron cargar las expansiones. Puedes buscar por nombre o código.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(
      () =>
        startSearch(async () => {
          try {
            const result = await searchBuilderCards({
              mode: searchMode,
              search: query,
              expansion,
              color,
              cost,
              leaderColors: JSON.parse(leaderColorsKey),
            });
            if (!cancelled) setRemote({ key, result });
          } catch {
            if (!cancelled)
              setRemote({
                key,
                result: {
                  cards: [],
                  issues: [],
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
  }, [query, searchMode, expansion, color, cost, leaderColorsKey, key]);
  const result = remote?.key === key ? remote.result : undefined,
    received = result?.cards ?? [];
  const english = catalog.filter((card) => card.language === "en");
  const effective = {
    ...filters,
    set: expansion === "promos" ? undefined : expansion,
    type:
      searchMode === "leader"
        ? "leader"
        : searchMode === "don"
          ? "don"
          : undefined,
  };
  const usable = (card: Card | OptcgCard) =>
    searchMode !== "cards" ||
    (["character", "event", "stage"].includes(card.card_type) &&
      compatibleWithLeader(card, leader));
  const saved = filterCards(english, effective).filter(usable),
    savedIds = new Set(
      english.map((card) => card.provider_card_id).filter(Boolean),
    );
  const available = filterCards(received, effective).filter(
    (card) => usable(card) && !savedIds.has(card.external_id),
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
    onFilters({ search: "" });
    setShowDon(false);
    setMessage({});
  };
  const accept = (card: Card, delta: number) => {
    if (card.card_type === "leader") {
      setShowDon(false);
      onSelect(card);
      if (!controlledMode) switchMode("cards");
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
      <div className="visual-picker-header visual-picker-header-open">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">CONSTRUCTOR · CARTAS EN INGLÉS</p>
            <h2 className="mt-1 text-xl font-bold">
              {mode === "leader"
                ? "Elige tu líder"
                : showDon
                  ? "DON!! separado"
                  : "Busca tus cartas"}
            </h2>
          </div>
        </div>
        {!controlledMode && (
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
        )}
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
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="col-span-2 min-w-0 sm:col-span-1">
            <Field label="Expansión">
              <select
                className="field"
                value={expansion}
                disabled={mode === "cards" && showDon}
                onChange={(event) =>
                  onFilters({ ...filters, set: event.target.value })
                }
              >
                <option value="">Todas las expansiones</option>
                {expansions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.id.replaceAll("-", "")}
                  </option>
                ))}
                {[
                  ...new Set(
                    english
                      .map((card) => card.set_code)
                      .filter((value): value is string => Boolean(value)),
                  ),
                ]
                  .filter(
                    (value) =>
                      !expansions.some(
                        (item) =>
                          item.id.replaceAll("-", "") ===
                          value.replaceAll("-", ""),
                      ) && value !== expansion,
                  )
                  .map((value) => (
                    <option key={value} value={value}>
                      {value} · nombre no disponible
                    </option>
                  ))}
                <option value="promos">Promocionales</option>
                {expansion &&
                  expansion !== "promos" &&
                  !expansions.some((item) => item.id === expansion) && (
                    <option value={expansion}>
                      {expansion} · nombre no disponible
                    </option>
                  )}
              </select>
            </Field>
          </div>
          <Field label="Color">
            <select
              className="field"
              value={color}
              disabled={mode === "cards" && showDon}
              onChange={(event) =>
                onFilters({ ...filters, color: event.target.value })
              }
            >
              <option value="">
                {mode === "cards" ? "Colores del líder" : "Todos los colores"}
              </option>
              {(mode === "cards"
                ? (leader?.colors ?? [])
                : (Object.keys(colorLabels) as CardColor[])
              ).map((value) => (
                <option key={value} value={value}>
                  {colorLabels[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Coste">
            <select
              className="field"
              value={cost}
              disabled={mode === "leader" || showDon}
              onChange={(event) =>
                onFilters({ ...filters, cost: event.target.value })
              }
            >
              <option value="">Todos los costes</option>
              {[
                ...new Set([
                  ...Array.from({ length: 21 }, (_, index) => String(index)),
                  ...received.flatMap((card) =>
                    card.cost === null ? [] : [String(card.cost)],
                  ),
                ]),
              ]
                .sort((a, b) => Number(a) - Number(b))
                .map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        {mode === "cards" && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">
              Solo cartas compatibles con tu líder · máximo 4 por identidad
            </p>
            <button
              type="button"
              className="home-text-link"
              aria-pressed={showDon}
              disabled={adding}
              onClick={() => {
                setShowDon(!showDon);
                onFilters({});
              }}
            >
              {showDon
                ? "Volver a cartas principales"
                : "Añadir DON!! separado"}
            </button>
          </div>
        )}
        {expansionNotice && (
          <p role="status" className="mt-3 text-xs text-amber-100">
            {expansionNotice}
          </p>
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
                copies = builderCopyCount(c, entries, catalog),
                canAdd =
                  isLeader ||
                  builderMaximumQuantity(c, entries, catalog) > quantity,
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
                      disabled={adding || !canAdd}
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
                            disabled={adding || !canAdd}
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
                    <span className="text-[9px] text-muted">
                      {!isLeader && copies >= (c.card_type === "don" ? 10 : 4)
                        ? "Límite"
                        : "EN"}
                    </span>
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

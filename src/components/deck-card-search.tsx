"use client";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { Check, Layers, Search, X } from "lucide-react";
import {
  searchBuilderCards,
  getBuilderExpansions,
  getBuilderVariants,
  getOptcgBuilderCard,
} from "@/app/(private)/cards/optcg-actions";
import {
  filterCards,
  type Card,
  type CardFilters,
  colorLabels,
  type CardColor,
  normalizeCardNumber,
} from "@/domain/cards";
import type { DeckEntry } from "@/domain/deck-import";
import type { OptcgCard, OptcgExpansion } from "@/domain/optcg";
import { CardArtwork } from "./card-catalog";
import { Modal } from "./modal";
import { CandidateArtwork, BuilderCardTile } from "./builder-card-tile";
import {
  candidateKey,
  groupCardVariants,
  mergeCardCandidates,
  type CardCandidate,
} from "@/domain/card-variants";
import { Field } from "./forms";
import { isCustomArtwork } from "@/domain/custom-artworks";
import { CustomArtworkView } from "./custom-artwork-view";
import { fanEdition, type FanCard } from "@/domain/fan-cards";
import { getBuilderFanCatalog } from "@/app/(private)/cards/fan-actions";
import { FanCardGallery } from "./fan-card-gallery";
import {
  compatibleWithLeader,
  visibleBuilderMainCard,
  builderMaximumQuantity,
  builderCopyCount,
} from "@/domain/deck-builder";
type SearchResult = { cards: OptcgCard[]; issues: string[]; error?: string };
type Candidate = CardCandidate;
export function DeckCardSearch({
  catalog,
  filters,
  onFilters,
  onSelect,
  onAdjust,
  entries,
  leaderId,
  mainCount,
  leaderActions,
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
  leaderActions?: ReactNode;
  mode?: "leader" | "cards";
}) {
  const [internalMode, setMode] = useState<"leader" | "cards">(
    leaderId ? "cards" : "leader",
  );
  const [expansions, setExpansions] = useState<OptcgExpansion[]>([]);
  const [expansionNotice, setExpansionNotice] = useState("");
  const [fanCatalog, setFanCatalog] = useState<{
    cards: FanCard[];
    error?: string;
  }>({ cards: [] });
  const reloadFanCatalog = async () => {
    try {
      setFanCatalog(await getBuilderFanCatalog());
    } catch {
      setFanCatalog({
        cards: [],
        error:
          "No se pudo cargar la edición personalizada. Comprueba la conexión y reintenta.",
      });
    }
  };
  useEffect(() => {
    let active = true;
    getBuilderFanCatalog()
      .then((result) => {
        if (active) setFanCatalog(result);
      })
      .catch(() => {
        if (active)
          setFanCatalog({
            cards: [],
            error:
              "No se pudo cargar la edición personalizada. Comprueba la conexión y reintenta.",
          });
      });
    return () => {
      active = false;
    };
  }, []);
  const [remote, setRemote] = useState<{ key: string; result: SearchResult }>();
  const [pending, startSearch] = useTransition();
  const [adding, startAdd] = useTransition();
  const [message, setMessage] = useState<{ error?: string; success?: string }>(
    {},
  );
  const [pageState, setPageState] = useState<{ key: string; page: number }>();
  const [selection, setSelection] = useState<{
    number: string;
    type: Card["card_type"];
  } | null>(null);
  const [zoomLeader, setZoomLeader] = useState(false);
  const [variantResults, setVariantResults] = useState<
    Record<string, SearchResult>
  >({});
  const [variantPage, setVariantPage] = useState(1);
  const requests = useRef(new Set<string>());
  const mode = controlledMode ?? internalMode;
  const leader = catalog.find((card) => card.id === leaderId);
  const leaderColorsKey = JSON.stringify(leader?.colors ?? []);
  const query = (filters.search ?? "").trim();
  const expansion = filters.set ?? "",
    color = filters.color ?? "",
    cost = filters.cost ?? "";
  const searchMode = mode;
  const fanMode = expansion === fanEdition.id;
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
    if (fanMode) return;
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
  }, [
    query,
    searchMode,
    expansion,
    color,
    cost,
    leaderColorsKey,
    key,
    fanMode,
  ]);
  const result = remote?.key === key ? remote.result : undefined,
    received = result?.cards ?? [];
  const english = catalog.filter((card) => card.language === "en");
  const effective = {
    ...filters,
    set: expansion === "promos" ? undefined : expansion,
    type: searchMode === "leader" ? "leader" : undefined,
  };
  const usable = (card: Card | OptcgCard) =>
    searchMode !== "cards" || visibleBuilderMainCard(card, leader, entries);
  const candidates: Candidate[] = mergeCardCandidates(english, received).filter(
    (candidate) =>
      filterCards([candidate.card], effective).length > 0 &&
      usable(candidate.card),
  );
  candidates.sort(
    (a, b) =>
      a.card.card_number.localeCompare(b.card.card_number) ||
      a.card.name.localeCompare(b.card.name),
  );
  const groups = groupCardVariants(candidates);
  const pageKey = `${key}:${mode}:${JSON.stringify(filters)}`,
    page = pageState?.key === pageKey ? pageState.page : 1,
    pageSize = 24;
  const showPage = Math.min(
    page,
    Math.max(1, Math.ceil(groups.length / pageSize)),
  );
  const updateFilters = (next: CardFilters) => {
    setMessage({});
    onFilters(next);
  };
  const switchMode = (next: "leader" | "cards") => {
    setMode(next);
    updateFilters({ search: "" });
    setMessage({});
  };
  const accept = (card: Card, delta: number) => {
    if (card.card_type === "leader") {
      setSelection(null);
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
  const loadVariants = async (number: string, retry = false) => {
    if (requests.current.has(number) || (!retry && variantResults[number]))
      return;
    requests.current.add(number);
    try {
      const response = await getBuilderVariants(number);
      setVariantResults((current) => ({ ...current, [number]: response }));
    } catch {
      setVariantResults((current) => ({
        ...current,
        [number]: {
          cards: [],
          issues: [],
          error:
            "No se pudieron consultar más variantes. Puedes usar las guardadas o reintentar.",
        },
      }));
    } finally {
      requests.current.delete(number);
    }
  };
  const openGroup = (number: string, type: Card["card_type"]) => {
    setSelection({ number, type });
    setVariantPage(1);
    setMessage({});
    void loadVariants(number);
  };
  const variantResult = selection
    ? variantResults[selection.number]
    : undefined;
  const variantCandidates = selection
    ? mergeCardCandidates(english, [
        ...received,
        ...(variantResult?.cards ?? []),
      ]).filter(
        (item) =>
          normalizeCardNumber(item.card.card_number) === selection.number &&
          item.card.card_type === selection.type &&
          (selection.type === "leader" ||
            visibleBuilderMainCard(item.card, leader, entries)),
      )
    : [];
  const variants = groupCardVariants(variantCandidates)[0]?.variants ?? [];
  const visibleVariantPage = Math.min(
    variantPage,
    Math.max(1, Math.ceil(variants.length / pageSize)),
  );
  return (
    <section
      className="visual-picker panel overflow-clip"
      aria-label="Buscar cartas para el mazo"
    >
      {mode === "cards" && leader && (
        <section
          className="leader-context"
          aria-label="Líder del mazo seleccionado"
        >
          <button
            type="button"
            className="leader-context-art"
            aria-label={`Ampliar líder ${leader.card_number} · ${leader.name}`}
            onClick={() => setZoomLeader(true)}
          >
            <CardArtwork key={leader.id} card={leader} full />
          </button>
          <div className="min-w-0">
            <p className="eyebrow">ESTÁS CONSTRUYENDO CON</p>
            <h2 className="mt-2 break-words text-sm font-semibold">
              {leader.name}
            </h2>
            <p className="mt-1 text-xs text-muted">
              {leader.card_number} ·{" "}
              {leader.colors.map((color) => colorLabels[color]).join(" / ")}
            </p>
            <p className="mt-2 text-[10px] text-accent">
              Toca el líder para ampliar su imagen
            </p>
            {leaderActions && (
              <div className="mt-4 flex flex-wrap gap-3">{leaderActions}</div>
            )}
          </div>
        </section>
      )}
      <div className="visual-picker-header visual-picker-header-open">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">CONSTRUCTOR</p>
            <h2 className="mt-1 text-xl font-bold">
              {fanMode
                ? "Edición personalizada"
                : mode === "leader"
                  ? "Elige tu líder"
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
                updateFilters({ ...filters, search: e.target.value })
              }
            />
            {filters.search && (
              <button
                type="button"
                className="absolute top-0 right-0 flex h-12 w-11 items-center justify-center text-muted"
                aria-label="Limpiar búsqueda"
                onClick={() => updateFilters({ ...filters, search: "" })}
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
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="col-span-2 min-w-0 sm:col-span-1">
            <Field label="Expansión">
              <select
                className="field"
                value={expansion}
                onChange={(event) =>
                  updateFilters({ ...filters, set: event.target.value })
                }
              >
                <option value="">Todas las expansiones</option>
                {Boolean(fanCatalog.cards.length || fanCatalog.error) && (
                  <option value={fanEdition.id}>{fanEdition.name}</option>
                )}
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
                  expansion !== fanEdition.id &&
                  !expansions.some((item) => item.id === expansion) && (
                    <option value={expansion}>
                      {expansion} · nombre no disponible
                    </option>
                  )}
              </select>
            </Field>
          </div>
          {!fanMode && (
            <>
              <Field label="Color">
                <select
                  className="field"
                  value={color}
                  onChange={(event) =>
                    updateFilters({ ...filters, color: event.target.value })
                  }
                >
                  <option value="">
                    {mode === "cards"
                      ? "Colores del líder"
                      : "Todos los colores"}
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
                  disabled={mode === "leader"}
                  onChange={(event) =>
                    updateFilters({ ...filters, cost: event.target.value })
                  }
                >
                  <option value="">Todos los costes</option>
                  {[
                    ...new Set([
                      ...Array.from({ length: 21 }, (_, index) =>
                        String(index),
                      ),
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
            </>
          )}
        </div>
        {!fanMode && expansionNotice && (
          <p role="status" className="mt-3 text-xs text-amber-100">
            {expansionNotice}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted">
          {!fanMode && (pending || !result) && (
            <span role="status">Buscando cartas…</span>
          )}
        </div>
      </div>
      <div className="p-3 sm:p-4">
        {fanMode ? (
          <FanCardGallery
            cards={fanCatalog.cards}
            search={query}
            error={fanCatalog.error}
            editionOnly
            onRetry={() => {
              void reloadFanCatalog();
            }}
          />
        ) : (
          <>
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
              {groups
                .slice((showPage - 1) * pageSize, showPage * pageSize)
                .map((group) => {
                  const item = group.representative,
                    card = item.card;
                  const selected =
                    mode === "leader" &&
                    leader &&
                    normalizeCardNumber(leader.card_number) === group.number;
                  const quantity = entries.reduce((sum, entry) => {
                    const savedCard = catalog.find(
                      (saved) => saved.id === entry.card_id,
                    );
                    return savedCard &&
                      normalizeCardNumber(savedCard.card_number) ===
                        group.number
                      ? sum + entry.quantity
                      : sum;
                  }, 0);
                  return (
                    <li key={group.number} className="min-w-0">
                      <div
                        className={`picker-card ${selected ? "picker-card-selected" : ""}`}
                      >
                        <button
                          type="button"
                          className="absolute inset-0 h-full w-full"
                          aria-label={`Ver variantes ${group.number} · ${card.name}`}
                          aria-haspopup="dialog"
                          aria-pressed={
                            mode === "leader" ? Boolean(selected) : undefined
                          }
                          onClick={() =>
                            openGroup(group.number, card.card_type)
                          }
                        >
                          <CandidateArtwork candidate={item} />
                        </button>
                        {selected ? (
                          <span
                            className="picker-quantity"
                            aria-label="Líder seleccionado"
                          >
                            <Check size={16} aria-hidden="true" />
                          </span>
                        ) : (
                          card.card_type !== "leader" && (
                            <span
                              className="picker-quantity"
                              aria-label={`Copias ${group.number}: ${quantity}`}
                            >
                              {quantity}
                            </span>
                          )
                        )}
                      </div>
                      <div className="picker-caption">
                        <span>{group.number}</span>
                        <Layers size={12} aria-hidden="true" />
                      </div>
                      <p
                        className="mt-1 line-clamp-2 px-1 text-[10px] leading-4 text-muted"
                        title={card.name}
                      >
                        {card.name}
                      </p>
                      <button
                        type="button"
                        className="home-text-link w-full justify-center"
                        aria-label={`Abrir variantes de ${group.number}`}
                        onClick={() => openGroup(group.number, card.card_type)}
                      >
                        Ver variantes
                      </button>
                    </li>
                  );
                })}
            </ul>
            {!candidates.length && !pending && result && !result.error && (
              <p className="py-8 text-center text-sm text-muted">
                Sin coincidencias. Cambia los filtros o busca otra carta.
              </p>
            )}
            {groups.length > pageSize && (
              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="button-secondary"
                  disabled={showPage === 1}
                  onClick={() =>
                    setPageState({ key: pageKey, page: showPage - 1 })
                  }
                >
                  Anterior
                </button>
                <span className="text-xs text-muted">
                  {showPage} / {Math.ceil(groups.length / pageSize)}
                </span>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={showPage * pageSize >= groups.length}
                  onClick={() =>
                    setPageState({ key: pageKey, page: showPage + 1 })
                  }
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {zoomLeader && leader && (
        <Modal
          title={`Líder seleccionado · ${leader.card_number}`}
          onClose={() => setZoomLeader(false)}
        >
          {isCustomArtwork(leader) ? (
            <CustomArtworkView card={leader} />
          ) : (
            <>
              <div className="leader-zoom-art">
                <CardArtwork key={leader.id} card={leader} full />
              </div>
              <p className="mt-4 text-center font-semibold">{leader.name}</p>
              <p className="mt-2 text-center text-xs text-muted">
                {leader.printing_code} ·{" "}
                {leader.set_code ?? "Expansión sin dato"}
              </p>
            </>
          )}
        </Modal>
      )}
      {selection && (
        <Modal
          title={`Variantes de ${selection.number}`}
          busy={adding}
          onClose={() => setSelection(null)}
        >
          <p className="mb-4 text-sm leading-6 text-muted">
            {selection.type === "leader"
              ? "Elige el arte o la reimpresión de tu líder."
              : "Añade la impresión que quieras. Las variantes comparten el límite de copias."}{" "}
            También se muestran variantes de otras expansiones.
          </p>
          {selection.type !== "leader" && (
            <p className="mb-4 text-sm text-accent" role="status">
              {mainCount}/50 cartas ·{" "}
              {builderCopyCount(
                variants[0]?.card ?? {
                  card_number: selection.number,
                  card_type: selection.type,
                  colors: [],
                },
                entries,
                catalog,
              )}
              /{selection.type === "don" ? 10 : 4} copias compartidas
            </p>
          )}
          {!variantResult && (
            <p role="status" className="mb-4 text-sm text-muted">
              Buscando variantes…
            </p>
          )}
          {variantResult?.error && (
            <p role="alert" className="mb-4 text-sm text-red-200">
              {variantResult.error}
            </p>
          )}
          {Boolean(variantResult?.issues.length) && (
            <details className="mb-4">
              <summary className="min-h-11 cursor-pointer text-sm text-amber-100">
                Avisos de variantes ({variantResult!.issues.length})
              </summary>
              <ul className="grid gap-2 text-xs text-muted">
                {variantResult!.issues.map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
            </details>
          )}
          {(variantResult?.error || Boolean(variantResult?.issues.length)) && (
            <button
              type="button"
              className="button-secondary mb-4"
              onClick={() => {
                void loadVariants(selection.number, true);
              }}
            >
              Reintentar consulta
            </button>
          )}
          {message.error && (
            <p role="alert" className="mb-4 text-sm text-red-200">
              {message.error}
            </p>
          )}
          {message.success && (
            <p role="status" className="mb-4 text-sm text-accent">
              {message.success}
            </p>
          )}
          {adding && (
            <p role="status" className="mb-4 text-sm text-muted">
              Añadiendo la impresión seleccionada…
            </p>
          )}
          <ul className="variant-grid" aria-label="Cuadrícula de variantes">
            {variants
              .slice(
                (visibleVariantPage - 1) * pageSize,
                visibleVariantPage * pageSize,
              )
              .map((item) => {
                const quantity =
                  item.kind === "saved"
                    ? (entries.find((entry) => entry.card_id === item.card.id)
                        ?.quantity ?? 0)
                    : 0;
                return (
                  <BuilderCardTile
                    key={candidateKey(item)}
                    candidate={item}
                    quantity={quantity}
                    selected={
                      item.kind === "saved" && item.card.id === leaderId
                    }
                    busy={adding}
                    canAdd={
                      item.card.card_type === "leader" ||
                      (compatibleWithLeader(item.card, leader) &&
                        builderMaximumQuantity(item.card, entries, catalog) >
                          quantity)
                    }
                    onChoose={(delta) => choose(item, delta)}
                  />
                );
              })}
          </ul>
          {!variants.length && variantResult && (
            <p className="mt-5 text-sm text-muted">
              No hay variantes compatibles disponibles. Cierra la ventana para
              cambiar los filtros o volver a consultar el proveedor.
            </p>
          )}
          {variants.length > pageSize && (
            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                className="button-secondary"
                disabled={visibleVariantPage === 1}
                onClick={() => setVariantPage(visibleVariantPage - 1)}
              >
                Variantes anteriores
              </button>
              <span className="text-xs text-muted">
                {visibleVariantPage} / {Math.ceil(variants.length / pageSize)}
              </span>
              <button
                type="button"
                className="button-secondary"
                disabled={visibleVariantPage * pageSize >= variants.length}
                onClick={() => setVariantPage(visibleVariantPage + 1)}
              >
                Más variantes
              </button>
            </div>
          )}
        </Modal>
      )}
    </section>
  );
}

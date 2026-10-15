"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { browseCardCatalog } from "@/app/(private)/cards/explorer-actions";
import { importOptcgCard } from "@/app/(private)/cards/optcg-actions";
import { colorLabels, typeLabels } from "@/domain/cards";
import { candidateKey } from "@/domain/card-variants";
import type {
  ExplorerFilters,
  ExplorerGroup,
  ExplorerPage,
  ExplorerPrinting,
} from "@/domain/card-explorer";
import { CandidateArtwork } from "./builder-card-tile";
import { Field, ActionForm } from "./forms";
import { Modal } from "./modal";
import { OptcgPrices } from "./optcg-prices";
import { CardOwnership } from "./card-ownership";
import { referenceForCandidate } from "@/domain/card-reference";
import { CardPriceHistory, type PriceHistoryCache } from "./card-price-history";
import { historySelection } from "@/domain/price-history";

function ExplorerFiltersPanel({
  filters,
  options,
  onChange,
}: {
  filters: ExplorerFilters;
  options?: ExplorerPage["options"];
  onChange: (filters: ExplorerFilters) => void;
}) {
  const [advanced, setAdvanced] = useState(false),
    advancedId = useId(),
    searchId = useId();
  const update = (key: keyof ExplorerFilters, value: string) =>
    onChange({ ...filters, [key]: value });
  const extraCount = [
    "type",
    "power",
    "counter",
    "attribute",
    "rarity",
    "trait",
  ].filter((key) => filters[key as keyof ExplorerFilters]).length;
  function select(
    key: "cost" | "power" | "counter" | "attribute" | "rarity" | "trait",
    label: string,
    all: string,
  ) {
    return (
      <Field label={label}>
        <select
          className="field"
          value={filters[key] ?? ""}
          onChange={(e) => update(key, e.target.value)}
        >
          <option value="">{all}</option>
          {[
            ...new Set([
              ...(options?.[key] ?? []),
              ...(filters[key] ? [filters[key]!] : []),
            ]),
          ].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </Field>
    );
  }
  return (
    <section
      className="panel grid gap-4 p-4 sm:p-5"
      aria-label="Filtros de cartas"
    >
      <div>
        <label className="field-label" htmlFor={searchId}>
          Buscar carta
        </label>
        <div className="relative">
          <Search
            size={20}
            aria-hidden="true"
            className="pointer-events-none absolute top-3.5 left-3 text-muted"
          />
          <input
            id={searchId}
            className="field explorer-search-input"
            placeholder="Nombre o número · Luffy, OP17-99…"
            maxLength={120}
            value={filters.search ?? ""}
            onChange={(e) => update("search", e.target.value)}
          />
          {filters.search && (
            <button
              type="button"
              className="picker-icon-button absolute top-0.5 right-1"
              aria-label="Limpiar búsqueda"
              onClick={() => update("search", "")}
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1">
          <Field label="Expansión">
            <select
              className="field"
              value={filters.set ?? ""}
              onChange={(e) => update("set", e.target.value)}
            >
              <option value="">Todas las expansiones</option>
              {options?.expansions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name ?? "Nombre no disponible"} · {item.id}
                </option>
              ))}
              {filters.set &&
                !options?.expansions.some(
                  (item) => item.id === filters.set,
                ) && (
                  <option value={filters.set}>
                    {filters.set} · nombre no disponible
                  </option>
                )}
            </select>
          </Field>
        </div>
        <Field label="Color">
          <select
            className="field"
            value={filters.color ?? ""}
            onChange={(e) => update("color", e.target.value)}
          >
            <option value="">Todos los colores</option>
            {Object.entries(colorLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        {select("cost", "Coste", "Todos los costes")}
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="button-secondary"
          aria-expanded={advanced}
          aria-controls={advancedId}
          onClick={() => setAdvanced(!advanced)}
        >
          <SlidersHorizontal size={16} aria-hidden="true" />{" "}
          {advanced ? "Menos filtros" : "Más filtros"}
          {extraCount > 0 ? ` (${extraCount})` : ""}
        </button>
        {Object.values(filters).some(Boolean) && (
          <button
            type="button"
            className="button-secondary"
            onClick={() => onChange({})}
          >
            Limpiar filtros
          </button>
        )}
      </div>
      <div id={advancedId} hidden={!advanced}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Tipo">
            <select
              className="field"
              value={filters.type ?? ""}
              onChange={(e) => update("type", e.target.value)}
            >
              <option value="">Todos los tipos</option>
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          {select("counter", "Counter", "Todos los counters")}
          {select("power", "Poder", "Todos los poderes")}
          {select("attribute", "Atributo", "Todos los atributos")}
          {select("rarity", "Rareza", "Todas las rarezas")}
          {select("trait", "Arquetipo / rasgos", "Todos los arquetipos")}
        </div>
      </div>
    </section>
  );
}

function PrintingDetail({
  printing,
  historyCache,
}: {
  printing: ExplorerPrinting;
  historyCache: PriceHistoryCache;
}) {
  const { candidate, expansionName, quote } = printing,
    card = candidate.card;
  const variant =
    candidate.kind === "remote"
      ? candidate.card.variant
      : candidate.card.printing_code;
  const facts = [
    [
      "Expansión",
      expansionName
        ? `${expansionName}${card.set_code ? ` · ${card.set_code}` : ""}`
        : card.set_code
          ? `${card.set_code} · nombre no disponible`
          : "No disponible",
    ],
    ["Coste", card.cost ?? "No aplicable / sin dato"],
    ["Tipo", typeLabels[card.card_type]],
    ["Arquetipo / rasgos", card.traits.join(" · ") || "No disponible"],
    [
      "Color",
      card.colors.map((c) => colorLabels[c]).join(" / ") ||
        "No aplicable / sin dato",
    ],
    ["Poder", card.power ?? "No aplicable / sin dato"],
    ["Counter", card.counter ?? "No aplicable / sin dato"],
    ["Vida", card.life ?? "No aplicable / sin dato"],
    ["Atributo", card.attribute ?? "No disponible"],
    ["Rareza", card.rarity ?? "No disponible"],
    ["Impresión", variant],
  ];
  return (
    <div className="grid min-w-0 content-start gap-5">
      <div>
        <p className="text-xs font-semibold tracking-widest text-accent">
          {card.card_number}
        </p>
        <h3 className="mt-2 break-words text-2xl font-bold">{card.name}</h3>
      </div>
      {quote ? (
        <OptcgPrices
          prices={quote.prices}
          fetchedAt={quote.fetchedAt}
          sourceDate={quote.sourceDate}
        />
      ) : (
        <section className="panel p-4">
          <h4 className="font-semibold">Precio no disponible</h4>
          <p className="mt-2 text-sm text-muted">
            No hay una cotización verificable para esta impresión.
          </p>
        </section>
      )}
      <CardOwnership reference={referenceForCandidate(candidate)} />
      <CardPriceHistory
        selection={historySelection(
          card.card_number,
          candidate.kind === "remote"
            ? candidate.card.external_id
            : candidate.card.source === "optcgapi"
              ? candidate.card.provider_card_id
              : null,
        )}
        cache={historyCache}
      />
      <section>
        <h4 className="font-semibold">Habilidad</h4>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-muted">
          {card.effect_text ||
            "El proveedor no ha facilitado una habilidad para esta carta."}
        </p>
      </section>
      <dl className="grid grid-cols-2 gap-3">
        {facts.map(([label, value]) => (
          <div
            key={label}
            className="min-w-0 rounded-xl border border-border p-3"
          >
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-1 break-words text-sm">{value}</dd>
          </div>
        ))}
      </dl>
      {candidate.kind === "saved" ? (
        <Link className="button-secondary" href={`/cards/${candidate.card.id}`}>
          Abrir ficha guardada
        </Link>
      ) : (
        <ActionForm
          action={importOptcgCard}
          submit="Guardar esta impresión"
          className="grid gap-3"
        >
          <input
            type="hidden"
            name="external_id"
            value={candidate.card.external_id}
          />
          <input type="hidden" name="card_number" value={card.card_number} />
          <input type="hidden" name="family" value={candidate.card.family} />
          <p className="text-xs leading-5 text-muted">
            Opcional: guarda la ficha en tu catálogo privado. Esto no añade
            copias a tu colección física.
          </p>
        </ActionForm>
      )}
    </div>
  );
}

function ExplorerModal({
  group,
  onClose,
}: {
  group: ExplorerGroup;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(0),
    [visible, setVisible] = useState(12);
  const [historyCache] = useState<PriceHistoryCache>(() => new Map());
  const printing = group.printings[selected];
  return (
    <Modal title={`Detalle de ${group.number}`} onClose={onClose}>
      <div className="explorer-detail">
        <div className="min-w-0">
          <div className="explorer-art">
            <CandidateArtwork
              key={candidateKey(printing.candidate)}
              candidate={printing.candidate}
            />
          </div>
          {group.printings.length > 1 && (
            <section className="mt-5" aria-label="Variantes de la carta">
              <h3 className="mb-3 text-sm font-semibold">
                Artes y reimpresiones ({group.printings.length})
              </h3>
              <div className="explorer-variants">
                {group.printings.slice(0, visible).map((item, index) => (
                  <button
                    key={candidateKey(item.candidate)}
                    type="button"
                    className={`rounded-lg border-2 p-1 ${index === selected ? "border-accent" : "border-border"}`}
                    aria-label={`Ver variante ${item.candidate.kind === "remote" ? item.candidate.card.variant : item.candidate.card.printing_code}`}
                    aria-pressed={index === selected}
                    onClick={() => setSelected(index)}
                  >
                    <div className="aspect-[5/7]">
                      <CandidateArtwork candidate={item.candidate} />
                    </div>
                  </button>
                ))}
              </div>
              {visible < group.printings.length && (
                <button
                  className="button-secondary mt-3 w-full"
                  onClick={() => setVisible(visible + 12)}
                >
                  Más variantes
                </button>
              )}
            </section>
          )}
        </div>
        <PrintingDetail
          key={candidateKey(printing.candidate)}
          printing={printing}
          historyCache={historyCache}
        />
      </div>
    </Modal>
  );
}

type CatalogResponse = Awaited<ReturnType<typeof browseCardCatalog>>;
export function CardExplorer() {
  const [filters, setFilters] = useState<ExplorerFilters>({}),
    [page, setPage] = useState(1),
    [retry, setRetry] = useState(0);
  const [result, setResult] = useState<CatalogResponse>(),
    [pending, setPending] = useState(true),
    [selected, setSelected] = useState<ExplorerGroup | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const key = JSON.stringify({ filters, page, retry });
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setPending(true);
      try {
        const data = await browseCardCatalog({
          filters: JSON.parse(key).filters,
          page: JSON.parse(key).page,
        });
        if (active) setResult(data);
      } catch {
        if (active)
          setResult({
            error:
              "No se pudo cargar el catálogo. Comprueba la conexión y vuelve a intentarlo.",
          });
      } finally {
        if (active) setPending(false);
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key]);
  const data = result && "groups" in result ? result : undefined;
  function change(next: ExplorerFilters) {
    setFilters(next);
    setPage(1);
    setPending(true);
  }
  function paginate(next: number) {
    setPage(next);
    setPending(true);
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  return (
    <div className="grid gap-5">
      <ExplorerFiltersPanel
        filters={filters}
        options={data?.options}
        onChange={change}
      />
      <div ref={resultsRef} className="scroll-mt-6" aria-busy={pending}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="text-sm text-muted">
            {pending
              ? "Cargando cartas…"
              : data
                ? `${data.total} cartas · ${data.printings} impresiones coincidentes`
                : "Catálogo no disponible"}
          </p>
          <button
            className="button-secondary"
            disabled={pending}
            onClick={() => {
              setPending(true);
              setRetry(retry + 1);
            }}
          >
            Volver a consultar
          </button>
        </div>
        {result && "error" in result && (
          <p role="alert" className="panel mb-4 p-4 text-sm text-red-200">
            {result.error}
          </p>
        )}
        {!data && pending && (
          <div className="picker-grid" aria-label="Cargando catálogo">
            {Array.from({ length: 9 }, (_, i) => (
              <div
                key={i}
                className="aspect-[5/7] animate-pulse rounded-xl bg-border"
              />
            ))}
          </div>
        )}
        {data && (
          <>
            <ul
              className={`picker-grid ${pending ? "opacity-50" : ""}`}
              aria-label="Resultados del catálogo"
            >
              {data.groups.map((group) => {
                const card = group.printings[0].candidate.card;
                return (
                  <li key={group.number} className="min-w-0">
                    <button
                      className="block w-full text-left"
                      type="button"
                      aria-label={`Ver carta ${group.number} · ${card.name}`}
                      disabled={pending}
                      onClick={() => setSelected(group)}
                    >
                      <div className="picker-card">
                        <CandidateArtwork
                          candidate={group.printings[0].candidate}
                        />
                        <span className="explorer-variant-count">
                          {group.printings.length}{" "}
                          {group.printings.length === 1 ? "arte" : "artes"}
                        </span>
                      </div>
                      <div className="picker-caption">
                        <span>{group.number}</span>
                      </div>
                      <p className="mt-2 break-words text-xs font-semibold">
                        {card.name}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
            {!pending && !data.total && (
              <section className="panel grid gap-3 p-6">
                <h2 className="font-semibold">
                  No hay cartas con estos filtros
                </h2>
                <p className="text-sm text-muted">
                  Prueba otro nombre, número o expansión, o limpia los filtros.
                </p>
              </section>
            )}
            <nav
              aria-label="Páginas del catálogo"
              className="mt-6 flex flex-wrap items-center justify-between gap-3"
            >
              <button
                className="button-secondary"
                disabled={pending || data.page <= 1}
                onClick={() => paginate(data.page - 1)}
              >
                Página anterior
              </button>
              <p className="text-xs text-muted">
                {data.page} / {data.pages}
              </p>
              <button
                className="button-secondary"
                disabled={pending || data.page >= data.pages}
                onClick={() => paginate(data.page + 1)}
              >
                Página siguiente
              </button>
            </nav>
          </>
        )}
      </div>
      {selected && (
        <ExplorerModal
          key={selected.number}
          group={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

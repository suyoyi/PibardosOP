"use client";
import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { typeLabels, colorLabels } from "@/domain/cards";
import { formatDeckAmount, type DeckDisplay } from "@/domain/deck-prices";
import { historySelection } from "@/domain/price-history";
import { CardArtwork } from "./card-catalog";
import { Modal } from "./modal";
import { OptcgPrices } from "./optcg-prices";
import { CardOwnership } from "./card-ownership";
import { CardPriceHistory, type PriceHistoryCache } from "./card-price-history";
const roleLabels = {
  leader: "Líder",
  main: "Mazo principal",
  don: "DON!! separado",
};
const date = (value: string) =>
  new Date(value).toLocaleString("es-ES", { timeZone: "Europe/Madrid" });

function DeckPrintingDetail({
  row,
  historyCache,
}: {
  row: DeckDisplay["rows"][number];
  historyCache: PriceHistoryCache;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const { card, quote } = row;
  return (
    <div className="explorer-detail">
      <div className="explorer-art">
        <CardArtwork key={card.id} card={card} full />
      </div>
      <div className="grid min-w-0 gap-5">
        <div>
          <p className="text-xs text-accent">
            {card.card_number} · {card.printing_code}
          </p>
          <h3 className="mt-2 break-words text-2xl font-bold">{card.name}</h3>
          <p className="mt-2 text-sm text-muted">
            {row.quantity} × en este mazo · {roleLabels[row.role]}
          </p>
        </div>
        <section
          aria-label="Precio de la carta en el mazo"
          className="rounded-xl border border-border p-4"
        >
          <h4 className="font-semibold">Precio de mercado</h4>
          <p className="mt-2 break-words text-2xl font-semibold text-accent">
            {formatDeckAmount(row.unitPrice)}
            {row.unitPrice !== null && (
              <span className="text-xs font-normal text-muted"> / unidad</span>
            )}
          </p>
          <p className="mt-2 break-words text-sm text-muted">
            {row.quantity} copias ·{" "}
            {row.lineTotal === null
              ? "Sin subtotal disponible"
              : `Subtotal ${formatDeckAmount(row.lineTotal)}`}
          </p>
          <p className="mt-2 text-xs text-muted">
            OPTCG API · moneda no especificada. Se usa el arte exacto de la
            lista.
          </p>
        </section>
        <section>
          <h4 className="font-semibold">Habilidad</h4>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">
            {card.effect_text ||
              "No hay un texto de habilidad disponible para esta carta."}
          </p>
        </section>
        <dl className="grid grid-cols-2 gap-3">
          {[
            ["Tipo", typeLabels[card.card_type]],
            ["Coste", card.cost],
            ["Arquetipo / rasgos", card.traits.join(" · ") || null],
            [
              "Colores",
              card.colors.map((c) => colorLabels[c]).join(" / ") || null,
            ],
            ["Poder", card.power],
            ["Counter", card.counter],
            ["Vida", card.life],
            ["Atributo", card.attribute],
            ["Expansión", card.set_code],
            ["Rareza", card.rarity],
          ].map(([label, value]) => (
            <div
              key={label}
              className="min-w-0 rounded-xl border border-border p-3"
            >
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="mt-1 break-words text-sm">
                {value ?? "No aplicable / sin dato"}
              </dd>
            </div>
          ))}
        </dl>
        {quote && (
          <OptcgPrices
            prices={quote.prices}
            fetchedAt={quote.fetched_at}
            sourceDate={quote.source_date}
            externalId={quote.external_id}
          />
        )}
        <CardOwnership reference={{ kind: "saved", id: card.id }} />
        <details onToggle={(e) => setHistoryOpen(e.currentTarget.open)}>
          <summary className="min-h-12 cursor-pointer py-3 text-sm text-accent">
            Ver histórico de precios
          </summary>
          {historyOpen && (
            <CardPriceHistory
              selection={historySelection(
                card.card_number,
                card.source === "optcgapi" ? card.provider_card_id : null,
              )}
              cache={historyCache}
            />
          )}
        </details>
        <Link href={`/cards/${card.id}`} className="button-secondary">
          Abrir ficha guardada
        </Link>
      </div>
    </div>
  );
}

export function DeckGallery({
  display,
  priceError,
  format,
  status,
}: {
  display: DeckDisplay;
  priceError?: string;
  format: string;
  status: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null),
    [historyCache] = useState<PriceHistoryCache>(() => new Map());
  const { rows, total, groups } = display,
    leader = rows.find((r) => r.role === "leader")!,
    selectedIndex = rows.findIndex((r) => r.card.id === selectedId),
    selected = rows[selectedIndex];
  return (
    <div className="grid min-w-0 gap-6">
      <section
        className="panel flex min-w-0 items-center gap-4 p-5"
        aria-label="Líder del mazo"
      >
        <button
          type="button"
          className="shrink-0 rounded-md"
          onClick={() => setSelectedId(leader.card.id)}
          aria-label={`Ampliar líder ${leader.card.name}`}
        >
          <CardArtwork card={leader.card} small />
        </button>
        <div className="min-w-0">
          <h2 className="break-words font-semibold">{leader.card.name}</h2>
          <p className="mt-2 text-sm text-muted">
            {leader.card.card_number} · {format} ·{" "}
            {status === "draft"
              ? "Borrador"
              : status === "active"
                ? "Activo"
                : "Archivado"}
          </p>
        </div>
      </section>
      <section
        className="panel grid min-w-0 gap-4 p-5"
        aria-label="Valoración del mazo"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">
              {total.complete
                ? "Total orientativo del mazo"
                : "Subtotal conocido del mazo"}
            </h2>
            <p className="mt-2 break-words text-3xl font-bold text-accent">
              {total.amount === null
                ? "No disponible"
                : formatDeckAmount(total.amount)}
            </p>
          </div>
          <p className="text-xs leading-6 text-muted">
            Precio de mercado · OPTCG API
            <br />
            Moneda no especificada
          </p>
        </div>
        {priceError && (
          <p role="alert" className="text-sm text-red-200">
            {priceError}
          </p>
        )}
        <p className="text-sm text-muted">
          Precio disponible para {total.pricedCopies} de {total.copies} copias ·{" "}
          {total.pricedPrintings} de {total.printings} impresiones.
        </p>
        {!total.complete && (
          <p className="text-sm text-amber-100">
            Falta el precio de {total.copies - total.pricedCopies} copias. El
            total completo no está disponible; las cartas sin precio no se
            valoran como cero.
          </p>
        )}
        <dl className="grid gap-3 sm:grid-cols-3">
          {groups.map((g) => (
            <div
              key={g.role}
              className="min-w-0 rounded-xl border border-border p-3"
            >
              <dt className="text-xs text-muted">
                {roleLabels[g.role]} · {g.copies} copias
              </dt>
              <dd className="mt-2 break-words text-sm font-semibold">
                {!g.copies
                  ? "Sin cartas"
                  : `${g.complete ? "Total" : "Subtotal"}: ${formatDeckAmount(g.amount)}`}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-xs leading-5 text-muted">
          Suma de precio unitario × copias del arte seleccionado, incluido el
          líder y los DON!! listados. Son cotizaciones guardadas, sin envío ni
          precios garantizados en tiempo real.
          {total.oldestFetchedAt &&
            ` La consulta más antigua utilizada es del ${date(total.oldestFetchedAt)}.`}{" "}
          Puedes volver a consultar una impresión desde su detalle.
        </p>
      </section>
      {(["list", "don"] as const).map((role) => {
        const group = rows.filter((r) =>
          role === "don" ? r.role === "don" : r.role !== "don",
        );
        const label = role === "list" ? "Lista del mazo" : roleLabels.don;
        return group.length ? (
          <section key={role} aria-label={`Cartas: ${label}`}>
            <h2 className="mb-4 font-semibold">
              {label}{" "}
              <span className="ml-2 text-sm font-normal text-muted">
                {group.reduce((n, r) => n + r.quantity, 0)} copias
              </span>
            </h2>
            <ul className="deck-art-grid">
              {group.map((row) => (
                <li
                  key={row.card.id}
                  className="min-w-0"
                  aria-label={`Impresión del mazo ${row.card.printing_code}`}
                >
                  <button
                    type="button"
                    className="group block w-full min-w-0 text-left"
                    onClick={() => setSelectedId(row.card.id)}
                    aria-label={`Ver carta ${row.card.card_number} · ${row.card.printing_code} · ${row.card.name}`}
                  >
                    <div className="relative aspect-[5/7] overflow-hidden rounded-lg border border-border bg-background transition group-hover:border-accent">
                      <CardArtwork card={row.card} full />
                      <span className="deck-price-badge">
                        {formatDeckAmount(row.unitPrice)}
                        {row.unitPrice !== null && (
                          <span className="text-[10px]"> / ud.</span>
                        )}
                      </span>
                    </div>
                    <div className="mt-2 flex items-start justify-between gap-2">
                      <p className="min-w-0 break-words text-xs font-semibold">
                        {row.card.card_number}
                      </p>
                      <span className="shrink-0 text-sm font-bold text-accent">
                        {row.quantity}×
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted">
                      {row.card.name}
                    </p>
                    <p className="mt-1 break-words text-xs text-muted">
                      {row.lineTotal === null
                        ? "Sin subtotal"
                        : `${row.quantity} × ${formatDeckAmount(row.unitPrice)} = ${formatDeckAmount(row.lineTotal)}`}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null;
      })}
      {rows.filter((r) => r.role === "main").length === 0 && (
        <p className="panel p-5 text-sm text-muted">
          Todavía no hay cartas principales. Añádelas desde Editar mazo.
        </p>
      )}
      {selected && (
        <Modal
          title={`Detalle de ${selected.card.card_number}`}
          onClose={() => setSelectedId(null)}
        >
          <nav
            aria-label="Recorrer cartas del mazo"
            className="mb-5 flex flex-wrap items-center justify-between gap-2"
          >
            <button
              type="button"
              className="button-secondary"
              disabled={selectedIndex === 0}
              onClick={() => setSelectedId(rows[selectedIndex - 1].card.id)}
              aria-label="Carta anterior"
            >
              <ChevronLeft size={18} aria-hidden="true" />
              Anterior
            </button>
            <p className="text-xs text-muted">
              {selectedIndex + 1} de {rows.length} impresiones
            </p>
            <button
              type="button"
              className="button-secondary"
              disabled={selectedIndex === rows.length - 1}
              onClick={() => setSelectedId(rows[selectedIndex + 1].card.id)}
              aria-label="Carta siguiente"
            >
              Siguiente
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </nav>
          <DeckPrintingDetail
            key={selected.card.id}
            row={selected}
            historyCache={historyCache}
          />
        </Modal>
      )}
    </div>
  );
}

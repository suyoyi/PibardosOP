import Link from "next/link";
import type { DeckComparison } from "@/domain/deck-comparison";
import type { Card } from "@/domain/cards";
import type { summarizeCounts } from "@/domain/statistics";
import { CardArtwork } from "./card-catalog";
import { ResultsChart } from "./charts";

type RecordSummary = ReturnType<typeof summarizeCounts>;
const percent = (value: number | null) =>
  value === null
    ? "—"
    : `${(value * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 })}%`;
function RecordCell({ record }: { record: RecordSummary }) {
  return (
    <>
      <p>
        {record.wins} V · {record.losses} D
      </p>
      <p className="mt-1 font-semibold text-accent">
        V {percent(record.winRate)} · D{" "}
        {percent(
          record.decisiveGames ? record.losses / record.decisiveGames : null,
        )}
      </p>
      <p className="mt-1 text-xs text-muted">n={record.decisiveGames}</p>
    </>
  );
}
function Breakdown({
  title,
  label,
  rows,
  names,
}: {
  title: string;
  label: string;
  rows: { id?: string; label: string; a: RecordSummary; b: RecordSummary }[];
  names: string[];
}) {
  return (
    <section aria-label={title} className="panel min-w-0 p-4 sm:p-5">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted">
        Victorias, derrotas y sus porcentajes. n = partidas usadas en el
        porcentaje.
      </p>
      {rows.length ? (
        <table className="mt-4 w-full table-fixed text-left text-sm">
          <thead>
            <tr>
              <th scope="col" className="break-words py-3 pr-2 text-muted">
                {label}
              </th>
              {names.map((name, i) => (
                <th scope="col" key={i} className="break-words p-2">
                  {i ? "B" : "A"} · {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id ?? r.label} className="border-t border-border">
                <th scope="row" className="break-words py-4 pr-2 font-normal">
                  {r.label}
                </th>
                <td className="p-2 align-top">
                  <RecordCell record={r.a} />
                </td>
                <td className="p-2 align-top">
                  <RecordCell record={r.b} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-4 text-sm text-muted">
          Todavía no hay partidas con estos filtros.
        </p>
      )}
    </section>
  );
}
export function DeckComparisonResults({
  comparison,
  decks,
  catalog,
}: {
  comparison: DeckComparison;
  decks: { id: string; name: string; leader_card_id: string }[];
  catalog: Card[];
}) {
  const { sides } = comparison,
    names = sides.map((s) => decks.find((d) => d.id === s.id)!.name);
  return (
    <div className="grid gap-6">
      <p className="text-sm text-muted">
        Mismos filtros para ambos mazos. V = victorias · D = derrotas.
        Porcentajes: V / (V + D) y D / (V + D). Sin partidas, se muestra —. Las
        muestras inferiores a 5 partidas son pequeñas; no determinan qué mazo es
        mejor.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {sides.map((side, index) => {
          const deck = decks.find((d) => d.id === side.id)!,
            leader = catalog.find((c) => c.id === deck.leader_card_id),
            s = side.summary;
          return (
            <section
              key={side.id}
              aria-label={`Mazo ${index ? "B" : "A"}: ${deck.name}`}
              className="panel min-w-0 p-5"
            >
              <div className="flex items-start gap-4">
                {leader && (
                  <div className="aspect-[5/7] w-20 shrink-0">
                    <CardArtwork card={leader} full />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="eyebrow">MAZO {index ? "B" : "A"}</p>
                  <h2 className="mt-2 break-words text-xl font-semibold">
                    <Link href={`/decks/${side.id}`}>{deck.name}</Link>
                  </h2>
                  <p className="mt-2 break-words text-xs text-muted">
                    Líder actual: {leader?.name ?? "No disponible"}
                  </p>
                </div>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-4">
                {[
                  ["Victorias", s.wins],
                  ["Derrotas", s.losses],
                  ["Victorias %", percent(s.winRate)],
                  ["Derrotas %", percent(s.lossRate)],
                ].map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-sm text-muted">{key}</dt>
                    <dd className="mt-1 text-2xl font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-sm text-muted">
                {s.totalGames} partidas guardadas · n={s.decisiveGames}
              </p>
              <p className="mt-2 text-sm text-muted">
                {s.totalGames === 0
                  ? "Sin partidas con estos filtros."
                  : s.decisiveGames < 5
                    ? "Muestra pequeña"
                    : "Umbral de 5 partidas alcanzado"}
              </p>
              {s.totalGames !== s.decisiveGames && (
                <p className="mt-2 text-xs text-muted">
                  Registros antiguos sin victoria o derrota no cuentan en los
                  porcentajes.
                </p>
              )}
            </section>
          );
        })}
      </div>
      <ResultsChart
        title="Victorias y derrotas por mazo"
        rows={sides.map((s, i) => ({
          label: names[i],
          id: s.id,
          ...s.summary,
        }))}
      />
      <Breakdown
        title="Primero frente a segundo"
        label="Salida"
        names={names}
        rows={sides[0].byOrder.map((r, i) => ({
          label: r.label,
          a: r,
          b: sides[1].byOrder[i],
        }))}
      />
      <p className="text-sm text-muted">
        Las variantes y reimpresiones del mismo líder rival se agrupan.
      </p>
      <Breakdown
        title="Comparación por líder rival"
        label="Líder rival"
        names={names}
        rows={comparison.opponents.map((r) => {
          const card = catalog.find((c) => c.id === r.label);
          return {
            ...r,
            id: r.label,
            label: card
              ? `${card.card_number} · ${card.name}`
              : "Líder no disponible",
          };
        })}
      />
      <Breakdown
        title="Evolución mensual (Madrid)"
        label="Mes"
        names={names}
        rows={comparison.months}
      />
      <Link href="/matches/new" className="button-secondary justify-self-start">
        Registrar partida
      </Link>
    </div>
  );
}

import type { buildAnalytics } from "@/domain/statistics";
import { ResultsChart } from "./charts";

const percent = (value: number | null) =>
  value === null
    ? "—"
    : `${(value * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 })}%`;

export function PlayOrderResults({
  title,
  rows,
}: {
  title: string;
  rows: ReturnType<typeof buildAnalytics>["byOrder"];
}) {
  return (
    <ResultsChart title={title} rows={rows}>
      <p className="mb-4 text-sm leading-6 text-muted">
        Cada porcentaje usa solo las victorias y derrotas de ese orden de
        salida. Las barras inferiores muestran cantidades de partidas.
      </p>
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {rows.map((row) => (
          <section
            key={row.label}
            aria-label={`Al ir ${row.label.toLowerCase()}`}
            className="min-w-0 rounded-xl border border-border p-4"
          >
            <h3 className="font-semibold">Al ir {row.label.toLowerCase()}</h3>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-muted">Victorias</dt>
                <dd className="mt-2 text-2xl font-semibold text-[#91d9b0]">
                  {percent(row.winRate)}
                </dd>
                <dd className="mt-1 text-xs text-muted">
                  {row.wins} de {row.decisiveGames}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Derrotas</dt>
                <dd className="mt-2 text-2xl font-semibold text-[#f4a5b1]">
                  {percent(row.lossRate)}
                </dd>
                <dd className="mt-1 text-xs text-muted">
                  {row.losses} de {row.decisiveGames}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-5 text-muted">
              n={row.decisiveGames} ·{" "}
              {row.decisiveGames === 0
                ? "Sin partidas válidas con este orden de salida."
                : row.decisiveGames < 5
                  ? "Muestra pequeña: interpreta estos porcentajes con cautela."
                  : "Partidas con victoria o derrota."}
            </p>
          </section>
        ))}
      </div>
    </ResultsChart>
  );
}

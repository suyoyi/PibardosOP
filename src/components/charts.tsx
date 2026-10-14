"use client";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
export type ResultChartRow = {
  id?: string;
  label: string;
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
  decisiveGames: number;
  winRate: number | null;
};
export function ResultsChart({
  title,
  rows,
}: {
  title: string;
  rows: ResultChartRow[];
}) {
  return (
    <section className="panel min-w-0 p-5" aria-label={title}>
      <h2 className="mb-5 text-lg font-semibold">{title}</h2>
      {rows.length ? (
        <>
          <div className="h-64 min-w-0" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
                margin={{ left: -20, right: 5, bottom: 20 }}
              >
                <CartesianGrid stroke="#2b3443" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#a3adbd", fontSize: 11 }}
                  tickFormatter={(value) =>
                    String(value).length > 12
                      ? `${String(value).slice(0, 11)}…`
                      : String(value)
                  }
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#a3adbd", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#151b25",
                    border: "1px solid #364152",
                    color: "#f1f3f7",
                  }}
                />
                <Legend />
                <Bar
                  dataKey="wins"
                  name="Victorias"
                  stackId="result"
                  fill="#91d9b0"
                />
                <Bar
                  dataKey="losses"
                  name="Derrotas"
                  stackId="result"
                  fill="#f4a5b1"
                />
                <Bar
                  dataKey="draws"
                  name="Empates"
                  stackId="result"
                  fill="#9bb8fa"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Datos de {title}; porcentaje excluye empates
              </caption>
              <thead>
                <tr className="text-muted">
                  <th className="py-3 pr-3">Grupo</th>
                  <th className="px-2">V</th>
                  <th className="px-2">D</th>
                  <th className="px-2">E</th>
                  <th className="px-2">Partidas</th>
                  <th className="px-2">Victorias %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id ?? row.label}
                    className="border-t border-border"
                  >
                    <th className="max-w-40 break-words py-3 pr-3 font-normal">
                      {row.label}
                    </th>
                    <td className="px-2">{row.wins}</td>
                    <td className="px-2">{row.losses}</td>
                    <td className="px-2">{row.draws}</td>
                    <td className="px-2">{row.totalGames}</td>
                    <td className="whitespace-nowrap px-2">
                      {row.winRate === null
                        ? "—"
                        : `${(row.winRate * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 })}%`}{" "}
                      <span className="text-xs text-muted">
                        (n={row.decisiveGames})
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">Sin partidas para este desglose.</p>
      )}
    </section>
  );
}
export function CostComparisonChart({
  rows,
}: {
  rows: { cost: string; before: number; after: number }[];
}) {
  return (
    <section
      className="panel min-w-0 p-5"
      aria-label="Comparación de curvas de coste"
    >
      <h2 className="mb-5 font-semibold">Curva de coste</h2>
      <div className="h-64" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows}>
            <CartesianGrid stroke="#2b3443" vertical={false} />
            <XAxis dataKey="cost" tick={{ fill: "#a3adbd" }} />
            <YAxis allowDecimals={false} tick={{ fill: "#a3adbd" }} />
            <Tooltip
              contentStyle={{
                background: "#151b25",
                border: "1px solid #364152",
              }}
            />
            <Legend />
            <Bar dataKey="before" name="Anterior" fill="#9bb8fa" />
            <Bar dataKey="after" name="Comparada" fill="#f5b66b" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 grid gap-2 text-sm text-muted">
        {rows.map((row) => (
          <li key={row.cost}>
            Coste {row.cost}: anterior {row.before} · comparada {row.after}
          </li>
        ))}
      </ul>
      {!rows.length && (
        <p className="text-sm text-muted">No hay cartas en estas versiones.</p>
      )}
    </section>
  );
}

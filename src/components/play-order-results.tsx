"use client";

import type { buildAnalytics } from "@/domain/statistics";
import { Pie, PieChart, ResponsiveContainer } from "recharts";

const winColor = "#4ade80";
const lossColor = "#f87171";

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
    <section className="panel min-w-0 p-5" aria-label={title}>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 mb-4 text-sm leading-6 text-muted">
        Cada porcentaje usa solo las victorias y derrotas de ese orden de
        salida.
      </p>
      {rows.some((row) => row.draws > 0) && (
        <p className="mb-4 text-xs text-amber-100">
          Hay registros antiguos pendientes de revisar que no cuentan en estos
          porcentajes.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((row) => (
          <section
            key={row.label}
            aria-label={`Al ir ${row.label.toLowerCase()}`}
            className="min-w-0 rounded-xl border border-border p-4"
          >
            <h3 className="font-semibold">Al ir {row.label.toLowerCase()}</h3>
            <div
              className="relative mx-auto my-4 aspect-square w-full max-w-52"
              aria-hidden="true"
            >
              {row.decisiveGames > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart accessibilityLayer={false}>
                    <Pie
                      data={[
                        {
                          name: "Victorias",
                          quantity: row.wins,
                          fill: winColor,
                        },
                        {
                          name: "Derrotas",
                          quantity: row.losses,
                          fill: lossColor,
                        },
                      ].filter((entry) => entry.quantity > 0)}
                      dataKey="quantity"
                      nameKey="name"
                      innerRadius="70%"
                      outerRadius="95%"
                      startAngle={90}
                      endAngle={-270}
                      stroke="var(--color-background)"
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="absolute inset-3 rounded-full border-[26px] border-border" />
              )}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-semibold tabular-nums">
                  {row.decisiveGames}
                </span>
                <span className="mt-1 text-xs text-muted">
                  {row.decisiveGames === 1 ? "partida" : "partidas"}
                </span>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <dt className="flex items-center gap-2 text-xs text-muted">
                  <span
                    className="size-2.5 rounded-full bg-[#4ade80]"
                    aria-hidden="true"
                  />
                  Victorias
                </dt>
                <dd className="mt-2 text-2xl font-semibold text-[#4ade80]">
                  {percent(row.winRate)}
                </dd>
                <dd className="mt-1 text-xs text-muted">
                  {row.wins} de {row.decisiveGames}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-xs text-muted">
                  <span
                    className="size-2.5 rounded-full bg-[#f87171]"
                    aria-hidden="true"
                  />
                  Derrotas
                </dt>
                <dd className="mt-2 text-2xl font-semibold text-[#f87171]">
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
    </section>
  );
}

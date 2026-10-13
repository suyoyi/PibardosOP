import { requireUser } from "@/lib/supabase/server";
import { summarizeCounts, type MatchResult } from "@/domain/statistics";
import { PageHeading, EmptyState } from "@/components/ui";
export default async function StatisticsPage() {
  const { supabase } = await requireUser();
  // Use database counts rather than a truncated match list for overall statistics.
  const responses = await Promise.all(
    (["win", "loss", "draw"] as MatchResult[]).map((result) =>
      supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("result", result),
    ),
  );
  if (responses.some((response) => response.error))
    throw new Error("No se pudieron calcular los resultados.");
  const [wins, losses, draws] = responses.map(
    (response) => response.count ?? 0,
  );
  const summary = summarizeCounts(wins, losses, draws);
  return (
    <>
      <PageHeading
        eyebrow="OBSERVA TU EVOLUCIÓN"
        title="Estadísticas"
        description="Sin resultados inventados. Los empates se muestran por separado y se excluyen del porcentaje de victorias."
      />
      <section
        aria-label="Resultados"
        className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        {[
          ["Victorias", summary.wins],
          ["Derrotas", summary.losses],
          ["Empates", summary.draws],
          [
            "Victorias %",
            summary.winRate === null
              ? "—"
              : new Intl.NumberFormat("es-ES", {
                  style: "percent",
                  maximumFractionDigits: 1,
                }).format(summary.winRate),
          ],
        ].map(([label, value]) => (
          <div key={label} className="panel p-5">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-3 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </section>
      <p className="mb-8 text-sm text-muted">
        {summary.totalGames} partidas · {summary.decisiveGames} victorias o
        derrotas para el porcentaje. Fórmula: victorias / (victorias +
        derrotas).
      </p>
      {summary.totalGames === 0 && (
        <EmptyState title="Necesitas partidas para ver tendencias">
          <p>
            Las comparaciones por mazo, rival y orden de juego se incorporarán
            con el registro de partidas.
          </p>
        </EmptyState>
      )}
    </>
  );
}

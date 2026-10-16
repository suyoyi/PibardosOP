import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { getCompetitiveWorkspace } from "@/lib/data";
import { buildAnalytics } from "@/domain/statistics";
import { PageHeading, EmptyState } from "@/components/ui";
import { ResultsChart } from "@/components/charts";
import { PlayOrderResults } from "@/components/play-order-results";
export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ deck?: string; format?: string }>;
}) {
  const { supabase } = await requireUser(),
    w = await getCompetitiveWorkspace(supabase),
    q = await searchParams;
  const records = w.matches
      .map((m) => ({
        ...m,
        deck_id:
          w.versions.find((v) => v.id === m.deck_version_id)?.deck_id ?? "",
      }))
      .filter(
        (m) =>
          (!q.deck || m.deck_id === q.deck) &&
          (!q.format || m.format === q.format),
      ),
    analytics = buildAnalytics(records),
    s = analytics.summary;
  const deckName = (id: string) =>
    w.decks.find((d) => d.id === id)?.name ?? "Mazo no disponible";
  const byDeck = analytics.byDeck.map((row) => ({
    ...row,
    id: row.label,
    label: deckName(row.label),
  }));
  const byOpponent = analytics.byOpponent.map((row) => {
    const c = w.catalog.find((c) => c.id === row.label);
    return {
      ...row,
      id: row.label,
      label: c ? `${c.card_number} · ${c.name}` : "Líder no disponible",
    };
  });
  return (
    <>
      <PageHeading
        eyebrow="OBSERVA TU EVOLUCIÓN"
        title="Estadísticas"
        description="Gráficas de tus partidas guardadas. El porcentaje se calcula como victorias entre victorias más derrotas."
      />
      <Link href="/statistics/compare" className="button-secondary mb-6">
        Comparar dos mazos
      </Link>
      <form className="panel mb-6 grid gap-4 p-5 sm:grid-cols-3">
        <label>
          <span className="field-label">Mazo para las gráficas</span>
          <select name="deck" className="field" defaultValue={q.deck ?? ""}>
            <option value="">Todos los mazos</option>
            {w.decks.map((d) => (
              <option value={d.id} key={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Formato para las gráficas</span>
          <select name="format" className="field" defaultValue={q.format ?? ""}>
            <option value="">Todos los formatos</option>
            {[...new Set(w.matches.map((m) => m.format))].sort().map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <button className="button-primary self-end">Aplicar filtros</button>
      </form>
      <section
        aria-label="Resultados"
        className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3"
      >
        {[
          ["Victorias", s.wins],
          ["Derrotas", s.losses],
          [
            "Victorias %",
            s.winRate === null
              ? "—"
              : `${(s.winRate * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 })}%`,
          ],
        ].map(([label, value]) => (
          <div key={label} className="panel p-5">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-3 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </section>
      <p className="mb-6 text-sm text-muted">
        {s.totalGames} partidas · {s.decisiveGames} victorias o derrotas para el
        porcentaje. Fórmula: victorias / (victorias + derrotas).
      </p>
      <div className="mb-6">
        <PlayOrderResults
          title="Primero frente a segundo"
          rows={analytics.byOrder}
        />
      </div>
      {s.totalGames ? (
        <div className="grid gap-6">
          <section className="panel p-5">
            <h2 className="font-semibold">Rendimiento por mazo</h2>
            <p className="mt-2 text-sm text-muted">
              Ordenamos primero los mazos con al menos{" "}
              {analytics.minimumDecisiveGames} victorias o derrotas. Una muestra
              pequeña no demuestra cuál es mejor.
            </p>
            <ul className="mt-4 grid gap-3 text-sm">
              {analytics.byDeck.map((row) => (
                <li key={row.label}>
                  {deckName(row.label)} ·{" "}
                  {row.winRate === null
                    ? "—"
                    : `${(row.winRate * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 })}%`}{" "}
                  · {row.totalGames} partidas (n={row.decisiveGames}) ·{" "}
                  {row.sufficientSample
                    ? "Umbral de muestra alcanzado"
                    : "Muestra pequeña"}
                </li>
              ))}
            </ul>
          </section>
          <ResultsChart title="Resultados por mazo" rows={byDeck} />
          <ResultsChart title="Resultados por líder rival" rows={byOpponent} />
          <ResultsChart
            title="Evolución mensual (Madrid)"
            rows={analytics.byMonth}
          />
        </div>
      ) : (
        <EmptyState title="Necesitas partidas para ver tendencias">
          <p>
            Registra partidas o cambia los filtros para obtener gráficas con
            resultados reales.
          </p>
        </EmptyState>
      )}
    </>
  );
}

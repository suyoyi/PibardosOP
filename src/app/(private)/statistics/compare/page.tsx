import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { getCompetitiveWorkspace } from "@/lib/data";
import {
  buildDeckComparison,
  comparisonIdsSchema,
  comparisonFiltersSchema,
} from "@/domain/deck-comparison";
import { PageHeading, EmptyState } from "@/components/ui";
import { DeckComparisonResults } from "@/components/deck-comparison-results";

export default async function DeckComparisonPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase } = await requireUser();
  const w = await getCompetitiveWorkspace(supabase),
    q = await searchParams;
  const ids = comparisonIdsSchema.safeParse(q),
    filters = comparisonFiltersSchema.safeParse(q);
  const a = ids.success ? (ids.data.a ?? w.decks[0]?.id) : undefined;
  const b = ids.success
    ? (ids.data.b ?? w.decks.find((d) => d.id !== a)?.id)
    : undefined;
  const validIds =
    ids.success &&
    !!a &&
    !!b &&
    a !== b &&
    [a, b].every((id) => w.decks.some((d) => d.id === id));
  const error = !filters.success
    ? "Revisa el formato y las fechas: usa un intervalo válido con la fecha inicial anterior o igual a la final."
    : !validIds
      ? "Selecciona dos mazos distintos de tu biblioteca."
      : "";
  const versionDecks = new Map(w.versions.map((v) => [v.id, v.deck_id]));
  const comparison =
    validIds && filters.success
      ? buildDeckComparison(
          w.matches.map((m) => ({
            ...m,
            deck_id: versionDecks.get(m.deck_version_id) ?? "",
          })),
          a!,
          b!,
          filters.data,
          w.catalog,
        )
      : null;
  const text = (key: string) => (typeof q[key] === "string" ? q[key] : "");
  return (
    <>
      <PageHeading
        eyebrow="DOS MAZOS, TUS RESULTADOS"
        title="Comparar mazos"
        description="Compara las partidas guardadas de dos mazos con el mismo formato e intervalo de fechas. Incluye todas las listas que has jugado con cada mazo."
      />
      <Link href="/statistics" className="button-secondary mb-6">
        Volver a estadísticas
      </Link>
      {w.decks.length < 2 ? (
        <EmptyState title="Necesitas dos mazos para comparar">
          <p>
            Añade otro mazo a tu biblioteca. Las estadísticas aparecerán cuando
            registres partidas.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link href="/decks/new" className="button-primary">
              Crear mazo
            </Link>
            <Link href="/decks/import" className="button-secondary">
              Importar mazo
            </Link>
          </div>
        </EmptyState>
      ) : (
        <>
          <form
            className="panel mb-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3"
            action="/statistics/compare"
          >
            {(["a", "b"] as const).map((key) => (
              <label key={key} className="min-w-0">
                <span className="field-label">Mazo {key.toUpperCase()}</span>
                <select
                  name={key}
                  aria-label={`Mazo ${key.toUpperCase()}`}
                  className="field"
                  defaultValue={key === "a" ? (a ?? "") : (b ?? "")}
                >
                  <option value="">Selecciona un mazo</option>
                  {w.decks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label className="min-w-0">
              <span className="field-label">Formato común</span>
              <select
                name="format"
                aria-label="Formato común"
                className="field"
                defaultValue={text("format")}
              >
                <option value="">Todos los formatos</option>
                {[...new Set(w.matches.map((m) => m.format))]
                  .sort()
                  .map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
              </select>
            </label>
            <label className="min-w-0">
              <span className="field-label">Desde (Madrid)</span>
              <input
                name="from"
                type="date"
                className="field"
                defaultValue={text("from")}
              />
            </label>
            <label className="min-w-0">
              <span className="field-label">Hasta (Madrid)</span>
              <input
                name="to"
                type="date"
                className="field"
                defaultValue={text("to")}
              />
            </label>
            <button className="button-primary self-end">
              Comparar resultados
            </button>
          </form>
          {error && (
            <p role="alert" className="panel mb-6 p-5 text-red-200">
              {error}
            </p>
          )}
          {comparison && (
            <DeckComparisonResults
              comparison={comparison}
              decks={w.decks}
              catalog={w.catalog}
            />
          )}
        </>
      )}
    </>
  );
}

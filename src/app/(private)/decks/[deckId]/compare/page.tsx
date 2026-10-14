import { notFound } from "next/navigation";
import { loadDeck } from "@/lib/deck-page";
import { compareEntries, costCurve } from "@/domain/decks";
import { PageHeading } from "@/components/ui";
import { CostComparisonChart } from "@/components/charts";
import { CardArtwork } from "@/components/card-catalog";
export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ deckId: string }>;
  searchParams: Promise<{ before?: string; after?: string }>;
}) {
  const { deckId } = await params,
    w = await loadDeck(deckId),
    q = await searchParams;
  const after = w.deckVersions.find(
      (v) => v.id === (q.after || w.deck.current_version_id),
    ),
    before =
      w.deckVersions.find((v) => v.id === q.before) ??
      (!q.before
        ? w.deckVersions[
            Math.max(0, w.deckVersions.findIndex((v) => v.id === after?.id) - 1)
          ]
        : undefined);
  if (!after || !before) notFound();
  const a = w.entries.filter((e) => e.deck_version_id === before.id),
    b = w.entries.filter((e) => e.deck_version_id === after.id),
    diff = compareEntries(a, b),
    curveA = costCurve(a, w.catalog),
    curveB = costCurve(b, w.catalog);
  const curves = [...new Set([...curveA, ...curveB].map((c) => c.cost))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((cost) => ({
      cost,
      before: curveA.find((c) => c.cost === cost)?.quantity ?? 0,
      after: curveB.find((c) => c.cost === cost)?.quantity ?? 0,
    }));
  return (
    <>
      <PageHeading
        eyebrow="EVOLUCIÓN DE TU LISTA"
        title={`Comparar ${w.deck.name}`}
        description="Selecciona dos versiones. Las diferencias se calculan a partir de sus listas completas."
      />
      <form className="panel mb-6 grid gap-4 p-5 sm:grid-cols-3">
        <label>
          <span className="field-label">Versión anterior</span>
          <select name="before" className="field" defaultValue={before.id}>
            {w.deckVersions.map((v) => (
              <option key={v.id} value={v.id}>
                Versión {v.version_number}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Versión comparada</span>
          <select name="after" className="field" defaultValue={after.id}>
            {w.deckVersions.map((v) => (
              <option key={v.id} value={v.id}>
                Versión {v.version_number}
              </option>
            ))}
          </select>
        </label>
        <button className="button-primary self-end">Comparar</button>
      </form>
      <div className="grid gap-6">
        <section className="panel grid gap-3 p-5">
          <h2 className="font-semibold">
            v{before.version_number} → v{after.version_number}
          </h2>
          <p className="text-sm">
            Principal:{" "}
            {a
              .filter((e) => e.role === "main")
              .reduce((n, e) => n + e.quantity, 0)}{" "}
            →{" "}
            {b
              .filter((e) => e.role === "main")
              .reduce((n, e) => n + e.quantity, 0)}{" "}
            cartas
          </p>
          <p className="text-sm">
            Líder: {w.catalog.find((c) => c.id === before.leader_card_id)?.name}{" "}
            → {w.catalog.find((c) => c.id === after.leader_card_id)?.name}
          </p>
          <p className="text-sm">
            Formato: {before.format} → {after.format}
          </p>
          <p className="whitespace-pre-wrap text-sm text-muted">
            Nota: {after.notes || "Sin nota"}
          </p>
        </section>
        <CostComparisonChart rows={curves} />
        <section className="panel p-5">
          <h2 className="mb-4 font-semibold">
            Cartas añadidas, retiradas o modificadas
          </h2>
          <ul className="grid gap-3">
            {diff.map((change) => {
              const card = w.catalog.find((c) => c.id === change.card_id);
              return (
                <li
                  key={change.card_id}
                  className="flex items-center gap-3 rounded-xl border border-border p-3"
                >
                  {card && <CardArtwork card={card} small />}
                  <div className="min-w-0">
                    <p className="break-words text-sm">
                      {card?.card_number} · {card?.name}
                    </p>
                    <p className="mt-2 text-sm text-accent">
                      {change.before} → {change.after} ·{" "}
                      {change.before === 0
                        ? "Añadida"
                        : change.after === 0
                          ? "Retirada"
                          : "Cantidad modificada"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          {!diff.length && (
            <p className="text-sm text-muted">
              No hay cambios en las cantidades de cartas.
            </p>
          )}
        </section>
        <section className="panel p-5">
          <h2 className="mb-4 font-semibold">
            Lista de v{after.version_number}
          </h2>
          <ul className="grid gap-2 text-sm">
            {b.map((entry) => (
              <li key={entry.card_id}>
                {entry.quantity} ×{" "}
                {w.catalog.find((c) => c.id === entry.card_id)?.card_number} ·{" "}
                {w.catalog.find((c) => c.id === entry.card_id)?.name}{" "}
                {entry.role === "don" ? "(DON!! separado)" : ""}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

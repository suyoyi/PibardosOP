"use client";
import { z } from "zod";
import { refreshOptcgPrices } from "@/app/(private)/cards/optcg-actions";
import { ActionForm } from "./forms";
const schema = z.array(
  z.object({
    metric: z.enum(["market_price", "inventory_price"]),
    amount: z.number().finite().nonnegative(),
    currency: z.null(),
  }),
);
export function OptcgPrices({
  prices,
  fetchedAt,
  sourceDate,
  externalId,
}: {
  prices: unknown;
  fetchedAt: string;
  sourceDate: string | null;
  externalId?: string;
}) {
  const p = schema.safeParse(prices),
    quotes = p.success ? p.data : [];
  return (
    <section className="panel mt-6 grid gap-5 p-5">
      <h2 className="font-semibold">Precios de la impresión</h2>
      {quotes.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {quotes.map((q) => (
            <li key={q.metric} className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted">
                {q.metric === "market_price"
                  ? "Precio de mercado"
                  : "Precio de inventario del proveedor"}
              </p>
              <p className="mt-2 text-xl font-semibold">
                {new Intl.NumberFormat("es-ES", {
                  maximumFractionDigits: 2,
                }).format(q.amount)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          Sin precios disponibles para esta impresión. No se muestran como cero.
        </p>
      )}
      <p className="text-xs leading-5 text-muted">
        Fuente: OPTCG API · consultado{" "}
        {new Date(fetchedAt).toLocaleString("es-ES", {
          timeZone: "Europe/Madrid",
        })}
        . Fecha indicada por el proveedor:{" "}
        {sourceDate
          ? new Date(`${sourceDate}T12:00:00Z`).toLocaleDateString("es-ES", {
              timeZone: "Europe/Madrid",
            })
          : "no disponible"}
        .
      </p>
      <p className="text-sm text-amber-100">
        Moneda no especificada por la API. Valores orientativos; no se
        convierten a euros ni se presentan como precios actuales garantizados.
      </p>
      {externalId && (
        <ActionForm
          action={refreshOptcgPrices}
          submit="Consultar precios de nuevo"
        >
          <input type="hidden" name="external_id" value={externalId} />
          <p className="text-xs text-muted">
            Reutilizamos consultas guardadas de menos de 15 minutos y respuestas
            del proveedor hasta una hora para reducir llamadas.
          </p>
        </ActionForm>
      )}
    </section>
  );
}

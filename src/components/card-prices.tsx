"use client";
import { z } from "zod";
import { refreshBerryWalletPrice } from "@/app/(private)/cards/berrywallet-actions";
import { ActionForm } from "./forms";
const quotesSchema = z.array(
  z.object({
    market: z.enum(["cardmarket", "tcgplayer"]),
    currency: z.enum(["EUR", "USD"]),
    metric: z.string(),
    amount: z.number().finite().nonnegative(),
  }),
);
export function CardPrices({
  prices,
  fetchedAt,
  externalId,
  language,
}: {
  prices: unknown;
  fetchedAt: string;
  externalId: string;
  language: string;
}) {
  const parsed = quotesSchema.safeParse(prices),
    quotes = parsed.success ? parsed.data : [];
  const labels: Record<string, string> = {
    avg: "Media",
    low: "Mínimo",
    trend: "Tendencia",
    avg1: "Media 1 día",
    avg7: "Media 7 días",
    avg30: "Media 30 días",
    low_price: "Mínimo",
    market_price: "Mercado",
    high_price: "Máximo",
    mid_price: "Mediana",
    direct_low_price: "Mínimo Direct",
  };
  return (
    <section className="panel mt-6 grid gap-5 p-5">
      <h2 className="font-semibold">Precios de la impresión</h2>
      <p className="text-xs leading-5 text-muted">
        Fuente: BerryWallet · consultado{" "}
        {new Date(fetchedAt).toLocaleString("es-ES", {
          timeZone: "Europe/Madrid",
        })}
        . Es la fecha de nuestra consulta; el proveedor actualiza normalmente
        una vez al día. Precios orientativos, sin envío ni conversión de moneda.
      </p>
      {quotes.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {quotes.map((q) => (
            <li
              key={`${q.market}-${q.metric}`}
              className="rounded-xl border border-border p-4"
            >
              <p className="text-xs text-muted">
                {q.market === "cardmarket" ? "CardMarket" : "TCGPlayer"} ·{" "}
                {labels[q.metric] ?? q.metric}
              </p>
              <p className="mt-2 text-xl font-semibold">
                {new Intl.NumberFormat("es-ES", {
                  style: "currency",
                  currency: q.currency,
                }).format(q.amount)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          El proveedor no incluye precios disponibles para esta impresión. No se
          muestran como cero.
        </p>
      )}
      <ActionForm
        action={refreshBerryWalletPrice}
        submit="Consultar precios de nuevo"
      >
        <input type="hidden" name="external_id" value={externalId} />
        <input
          type="hidden"
          name="language"
          value={language === "ja" ? "jp" : "en"}
        />
        <p className="text-xs text-muted">
          Reutilizamos consultas de menos de 15 minutos para ahorrar cuota.
        </p>
      </ActionForm>
    </section>
  );
}

"use client";
import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getCardPriceHistory } from "@/app/(private)/cards/price-history-actions";
import type { PriceHistorySelection } from "@/domain/price-history";

type HistoryResponse = Awaited<ReturnType<typeof getCardPriceHistory>>;
export type PriceHistoryCache = Map<
  string,
  { expires: number; response: Promise<HistoryResponse> }
>;
const formatPrice = (value: number) =>
  new Intl.NumberFormat("es-ES", { maximumFractionDigits: 8 }).format(value);

export function CardPriceHistory({
  selection,
  cache,
}: {
  selection: PriceHistorySelection | null;
  cache?: PriceHistoryCache;
}) {
  const [localCache] = useState<PriceHistoryCache>(() => new Map());
  const [result, setResult] = useState<HistoryResponse>(),
    [pending, setPending] = useState(true),
    [retry, setRetry] = useState(0);
  const key = selection ? JSON.stringify(selection) : "";
  useEffect(() => {
    if (!key) return;
    let active = true;
    const entries = cache ?? localCache;
    const timer = setTimeout(() => {
      setPending(true);
      let entry = entries.get(key);
      if (!entry || entry.expires <= Date.now()) {
        const response = getCardPriceHistory(JSON.parse(key)).catch(() => ({
          error:
            "No se pudo cargar el histórico. Revisa la conexión y vuelve a intentarlo.",
        }));
        entry = { response, expires: Date.now() + 60000 };
        if (entries.size >= 128) entries.delete(entries.keys().next().value!);
        entries.set(key, entry);
      }
      void entry.response.then((value) => {
        if (active) {
          setResult(value);
          setPending(false);
        }
      });
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key, retry, cache, localCache]);
  function reload() {
    (cache ?? localCache).delete(key);
    setPending(true);
    setRetry(retry + 1);
  }
  const data = result && !("error" in result) ? result : undefined;
  return (
    <section
      className="panel grid min-w-0 gap-4 p-4"
      aria-label="Histórico de precios"
      aria-busy={Boolean(key) && pending}
    >
      <div>
        <h3 className="font-semibold">Histórico de precios · 2 semanas</h3>
        <p className="mt-1 text-xs text-muted">
          OPTCG API · impresión seleccionada · moneda sin especificar
        </p>
      </div>
      {!key ? (
        <p className="text-sm text-muted">
          No hay un histórico de OPTCG API asociado a esta impresión.
        </p>
      ) : pending ? (
        <p role="status" className="py-8 text-sm text-muted">
          Cargando histórico…
        </p>
      ) : result && "error" in result ? (
        <div className="grid gap-3">
          <p role="alert" className="text-sm text-amber-100">
            {result.error}
          </p>
          <button
            type="button"
            className="button-secondary justify-self-start"
            onClick={reload}
          >
            Reintentar histórico
          </button>
        </div>
      ) : data && data.status !== "available" ? (
        <p className="text-sm leading-6 text-muted">{data.message}</p>
      ) : (
        data && (
          <>
            <p className="text-xs leading-5 text-muted">
              Ventana anunciada por el proveedor. Sin fechas individuales ni
              orden temporal documentado: se muestran sus campos Day1–Day13 y la
              última cotización, sin asignarles fechas de calendario.
            </p>
            <div className="h-52 min-w-0" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  accessibilityLayer={false}
                  data={data.points.filter((point) => point.slot !== "Última")}
                  margin={{ top: 10, left: 0, right: 12, bottom: 0 }}
                >
                  <CartesianGrid stroke="#2b3443" vertical={false} />
                  <XAxis
                    dataKey="slot"
                    tick={{ fill: "#a3adbd", fontSize: 10 }}
                    minTickGap={24}
                  />
                  <YAxis
                    width={48}
                    domain={[0, "auto"]}
                    tick={{ fill: "#a3adbd", fontSize: 10 }}
                    tickFormatter={formatPrice}
                  />
                  <Tooltip
                    formatter={(value) =>
                      typeof value === "number"
                        ? formatPrice(value)
                        : "Sin dato"
                    }
                    contentStyle={{
                      background: "#151b25",
                      border: "1px solid #364152",
                      color: "#f1f3f7",
                      borderRadius: 8,
                    }}
                  />
                  <Line
                    type="linear"
                    dataKey="market"
                    name="Mercado"
                    stroke="#f5b66b"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="linear"
                    dataKey="inventory"
                    name="Inventario del proveedor"
                    stroke="#8ecbd8"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    dot={{ r: 2 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-4 text-xs">
              <span className="text-accent">— Mercado</span>
              <span className="text-[#8ecbd8]">┄ Inventario del proveedor</span>
            </div>
            <p className="text-xs leading-5 text-muted">
              Referencia del proveedor:{" "}
              {data.sourceDate
                ? new Date(`${data.sourceDate}T12:00:00Z`).toLocaleDateString(
                    "es-ES",
                    { timeZone: "Europe/Madrid" },
                  )
                : "sin fecha"}
              . Los valores ausentes dejan huecos; no se rellenan ni se
              convierten a cero.
            </p>
            <details>
              <summary className="min-h-11 cursor-pointer py-3 text-sm text-accent">
                Ver valores del histórico
              </summary>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <caption className="sr-only">
                    Valores del histórico de la impresión seleccionada
                  </caption>
                  <thead>
                    <tr>
                      <th className="py-3">Campo</th>
                      <th>Mercado</th>
                      <th>Inventario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.points.map((point) => (
                      <tr key={point.slot} className="border-t border-border">
                        <th className="py-3 font-normal">{point.slot}</th>
                        <td>
                          {point.market === null
                            ? "Sin dato"
                            : formatPrice(point.market)}
                        </td>
                        <td>
                          {point.inventory === null
                            ? "Sin dato"
                            : formatPrice(point.inventory)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )
      )}
      {data && data.issues.length > 0 && (
        <details>
          <summary className="min-h-11 cursor-pointer py-3 text-xs text-amber-100">
            Avisos del histórico ({data.issues.length})
          </summary>
          <ul className="grid gap-2 text-xs text-muted">
            {data.issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

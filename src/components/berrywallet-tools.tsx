"use client";
import { useState, useTransition } from "react";
import {
  searchBerryWallet,
  importBerryWalletCard,
  syncBerryWalletSet,
} from "@/app/(private)/cards/berrywallet-actions";
import type { BerryPreview } from "@/domain/berrywallet";
import { ActionForm, Field } from "./forms";
export function BerryWalletTools({ enabled }: { enabled: boolean }) {
  const [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [result, setResult] = useState<{
      error?: string;
      cards?: BerryPreview[];
      total?: number;
    }>({}),
    [pending, start] = useTransition();
  const search = (p: number) =>
    start(async () => {
      setResult(await searchBerryWallet(query, p));
      setPage(p);
    });
  return (
    <section
      aria-label="Catálogo BerryWallet"
      className="panel mb-6 grid gap-5 p-5"
    >
      <h2 className="text-lg font-semibold">BerryWallet</h2>
      <p className="text-sm leading-6 text-muted">
        Añade cartas del proveedor o carga una colección. Las fichas guardadas
        se conservan para tu historial; los precios pueden consultarse de nuevo.
        Los datos incompletos se explican y no se inventan.
      </p>
      {!enabled ? (
        <p className="text-sm text-amber-100">
          El proveedor no está conectado. Puedes usar el catálogo manual.
        </p>
      ) : (
        <>
          <form
            className="grid gap-3 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              search(1);
            }}
          >
            <Field label="Buscar en BerryWallet">
              <input
                className="field"
                required
                minLength={2}
                maxLength={120}
                placeholder="Código o nombre"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setResult({});
                  setPage(1);
                }}
              />
            </Field>
            <button className="button-secondary self-end" disabled={pending}>
              {pending ? "Consultando…" : "Buscar en el proveedor"}
            </button>
          </form>
          <p className="text-xs text-muted">
            La búsqueda documentada consulta el catálogo inglés de TCGPlayer.
            Para cartas japonesas, carga una colección con su idioma explícito.
          </p>
          {result.error && (
            <p role="alert" className="text-sm text-red-200">
              {result.error}
            </p>
          )}
          {result.cards && (
            <>
              <p className="text-sm text-muted">
                {result.total} resultados del proveedor · página {page}. La
                consulta no guarda ninguna carta hasta que la añades.
              </p>
              <ul className="grid gap-3 sm:grid-cols-2">
                {result.cards.map((card) => (
                  <li key={card.external_id}>
                    <ActionForm
                      action={importBerryWalletCard}
                      submit="Añadir al catálogo"
                    >
                      <input
                        type="hidden"
                        name="external_id"
                        value={card.external_id}
                      />
                      <p className="text-xs text-accent">{card.card_number}</p>
                      <h3 className="break-words font-semibold">{card.name}</h3>
                      <p className="text-sm text-muted">{card.variant}</p>
                    </ActionForm>
                  </li>
                ))}
              </ul>
              {!result.cards.length && (
                <p className="text-sm text-muted">
                  Sin coincidencias. Puedes introducir la carta manualmente.
                </p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  className="button-secondary"
                  disabled={pending || page === 1}
                  onClick={() => search(page - 1)}
                >
                  Página anterior
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={pending || page * 12 >= (result.total ?? 0)}
                  onClick={() => search(page + 1)}
                >
                  Página siguiente
                </button>
              </div>
            </>
          )}
          <details>
            <summary className="min-h-12 cursor-pointer py-3 text-sm text-accent">
              Cargar una colección completa
            </summary>
            <ActionForm action={syncBerryWalletSet} submit="Cargar colección">
              <Field label="Código de colección BerryWallet">
                <input
                  name="set_code"
                  className="field"
                  required
                  maxLength={40}
                  placeholder="OP01"
                />
              </Field>
              <Field label="Idioma de la colección">
                <select name="language" className="field">
                  <option value="en">Inglés</option>
                  <option value="jp">Japonés</option>
                </select>
              </Field>
              <p className="text-xs leading-5 text-muted">
                Carga solo la colección elegida y respeta las páginas del
                proveedor. Si se interrumpe, puedes reintentar: no se duplican
                las fichas ya guardadas. La disponibilidad de cada edición
                depende de BerryWallet.
              </p>
            </ActionForm>
          </details>
        </>
      )}
    </section>
  );
}

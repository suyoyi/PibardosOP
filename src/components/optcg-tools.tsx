"use client";
import { useState, useTransition } from "react";
import {
  searchOptcg,
  importOptcgCard,
  syncOptcgSet,
} from "@/app/(private)/cards/optcg-actions";
import type { OptcgCard, OptcgFamily } from "@/domain/optcg";
import { ActionForm, Field } from "./forms";
export function OptcgTools() {
  const [query, setQuery] = useState(""),
    [family, setFamily] = useState<OptcgFamily>("sets"),
    [page, setPage] = useState(1),
    [result, setResult] = useState<{
      error?: string;
      cards?: OptcgCard[];
      issues?: string[];
      received?: number;
    }>({}),
    [pending, start] = useTransition();
  return (
    <section
      aria-label="Catálogo OPTCG API"
      className="panel mb-6 grid gap-5 p-5"
    >
      <h2 className="text-lg font-semibold">OPTCG API</h2>
      <p className="text-sm leading-6 text-muted">
        Busca cartas por código o nombre y añade la impresión que quieras.
        Catálogo inglés, sin clave. Las fichas guardadas se conservan para tu
        historial; los datos incompletos se muestran con avisos.
      </p>
      <form
        className="grid gap-3 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setResult(await searchOptcg(query, family));
            setPage(1);
          });
        }}
      >
        <Field label="Buscar en OPTCG API">
          <input
            className="field"
            required
            minLength={2}
            maxLength={120}
            disabled={pending}
            placeholder="OP01-001 o nombre"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setResult({});
              setPage(1);
            }}
          />
        </Field>
        <Field label="Grupo de cartas">
          <select
            className="field"
            disabled={pending}
            value={family}
            onChange={(e) => {
              setFamily(e.target.value as OptcgFamily);
              setResult({});
              setPage(1);
            }}
          >
            <option value="sets">Sets</option>
            <option value="decks">Mazos iniciales</option>
            <option value="promos">Promos y reimpresiones</option>
            <option value="don">DON!!</option>
          </select>
        </Field>
        <button className="button-secondary self-end" disabled={pending}>
          {pending ? "Consultando…" : "Buscar en el proveedor"}
        </button>
      </form>
      {result.error && (
        <p role="alert" className="text-sm text-red-200">
          {result.error}
        </p>
      )}
      {Boolean(result.issues?.length) && (
        <details>
          <summary className="min-h-12 cursor-pointer py-3 text-sm text-amber-100">
            Avisos del proveedor ({result.issues!.length})
          </summary>
          <ul className="grid gap-2 text-sm text-amber-100">
            {result.issues!.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </details>
      )}
      {result.cards && (
        <>
          <p className="text-sm text-muted">
            {result.cards.length} impresiones utilizables de {result.received}{" "}
            entradas · página {page}. No se guardan hasta que las añades.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {result.cards.slice((page - 1) * 12, page * 12).map((card) => (
              <li key={card.external_id}>
                <ActionForm
                  action={importOptcgCard}
                  submit="Añadir al catálogo"
                >
                  <input
                    type="hidden"
                    name="external_id"
                    value={card.external_id}
                  />
                  <input
                    type="hidden"
                    name="card_number"
                    value={card.card_number}
                  />
                  <input type="hidden" name="family" value={card.family} />
                  <p className="text-xs text-accent">{card.card_number}</p>
                  <h3 className="break-words font-semibold">{card.name}</h3>
                  <p className="break-words text-sm text-muted">
                    {card.variant}
                    {card.is_base ? " · Impresión base" : ""}
                  </p>
                </ActionForm>
              </li>
            ))}
          </ul>
          {!result.cards.length && (
            <p className="text-sm text-muted">
              Sin coincidencias utilizables. Prueba otro código o vuelve a
              consultar el proveedor.
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              className="button-secondary"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Página anterior
            </button>
            <button
              type="button"
              className="button-secondary"
              disabled={page * 12 >= result.cards.length}
              onClick={() => setPage(page + 1)}
            >
              Página siguiente
            </button>
          </div>
        </>
      )}
      <details>
        <summary className="min-h-12 cursor-pointer py-3 text-sm text-accent">
          Cargar una colección o mazo inicial
        </summary>
        <ActionForm action={syncOptcgSet} submit="Cargar colección">
          <Field label="Código de colección OPTCG">
            <input
              name="set_code"
              className="field"
              required
              maxLength={10}
              placeholder="OP01 o ST01"
            />
          </Field>
          <p className="text-xs leading-5 text-muted">
            Carga solo la colección elegida. Puedes reintentar sin duplicar las
            fichas. Se reutilizan respuestas del proveedor hasta una hora para
            reducir llamadas; las imágenes ausentes usan un marcador.
          </p>
        </ActionForm>
      </details>
    </section>
  );
}

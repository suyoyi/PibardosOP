"use client";
import { collectionEnabled } from "@/lib/features";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getCardOwnership,
  saveCollectionItem,
  saveWish,
  removeOwnershipRecord,
  type CardOwnershipState,
} from "@/app/(private)/collection/actions";
import {
  availableQuantity,
  reservedQuantity,
  ownedPrintingQuantity,
  priorityLabels,
  type CollectionItem,
  type WishlistItem,
} from "@/domain/collection";
import type { CardReference } from "@/domain/card-reference";
import { Field } from "./forms";
type Reply = { error?: string; success?: string; state?: CardOwnershipState };
type Run = (task: () => Promise<Reply>) => void;
function LotForm({
  item,
  reference,
  run,
}: {
  item?: CollectionItem;
  reference: CardReference;
  run: Run;
}) {
  const [id] = useState(() => item?.id ?? crypto.randomUUID());
  return (
    <form
      aria-label={
        item
          ? `Editar lote ${item.storage_location || "Sin ubicación"}`
          : "Nuevo lote"
      }
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const f = new FormData(event.currentTarget);
        run(() =>
          saveCollectionItem(reference, {
            id,
            expected_updated_at: item?.updated_at ?? null,
            quantity_owned: Number(f.get("owned")),
            quantity_tradeable: Number(f.get("tradeable")),
            finish: String(f.get("finish")),
            storage_location: String(f.get("location")),
          }),
        );
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Copias que tengo">
          <input
            className="field"
            type="number"
            name="owned"
            min={0}
            max={9999}
            required
            defaultValue={item?.quantity_owned ?? 0}
          />
        </Field>
        <Field label="Para intercambio">
          <input
            className="field"
            type="number"
            name="tradeable"
            min={0}
            max={9999}
            required
            defaultValue={item?.quantity_tradeable ?? 0}
          />
        </Field>
      </div>
      <Field label="Acabado">
        <input
          className="field"
          name="finish"
          required
          maxLength={80}
          defaultValue={item?.finish ?? "standard"}
          placeholder="standard, foil…"
        />
      </Field>
      <Field label="Ubicación">
        <input
          className="field"
          name="location"
          maxLength={200}
          defaultValue={item?.storage_location ?? ""}
          placeholder="Carpeta, caja, estantería…"
        />
      </Field>
      <button type="submit" className="button-secondary">
        {item ? "Guardar cambios del lote" : "Guardar lote"}
      </button>
    </form>
  );
}
function WishForm({
  wish,
  reference,
  run,
}: {
  wish: WishlistItem | null;
  reference: CardReference;
  run: Run;
}) {
  const [id] = useState(() => wish?.id ?? crypto.randomUUID());
  return (
    <form
      aria-label="Objetivo de la lista de deseos"
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const f = new FormData(event.currentTarget);
        run(() =>
          saveWish(reference, {
            id,
            expected_updated_at: wish?.updated_at ?? null,
            target_quantity: Number(f.get("target")),
            priority: String(f.get("priority")),
            notes: String(f.get("notes")),
          }),
        );
      }}
    >
      <Field
        label="Objetivo total de esta impresión"
        hint="Cantidad total que quieres tener en inglés, contando las copias que ya posees."
      >
        <input
          className="field"
          type="number"
          name="target"
          required
          min={1}
          max={9999}
          defaultValue={wish?.target_quantity ?? 1}
        />
      </Field>
      <Field label="Prioridad">
        <select
          className="field"
          name="priority"
          defaultValue={wish?.priority ?? "normal"}
        >
          {Object.entries(priorityLabels).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Notas del deseo">
        <textarea
          className="field"
          name="notes"
          maxLength={3000}
          rows={2}
          defaultValue={wish?.notes ?? ""}
        />
      </Field>
      <button type="submit" className="button-secondary">
        {wish ? "Actualizar deseo" : "Guardar deseo"}
      </button>
    </form>
  );
}
type CardOwnershipProps = {
  reference: CardReference;
  initialState?: CardOwnershipState;
};
export function CardOwnership(props: CardOwnershipProps) {
  return collectionEnabled ? <EnabledCardOwnership {...props} /> : null;
}
function EnabledCardOwnership({ reference, initialState }: CardOwnershipProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(initialState),
    [message, setMessage] = useState<Reply>({}),
    [pending, start] = useTransition(),
    router = useRouter();
  function run(task: () => Promise<Reply>) {
    start(async () => {
      setMessage({});
      try {
        const result = await task();
        setMessage(result);
        if (result.state) setData(result.state);
        if (result.success) router.refresh();
      } catch {
        setMessage({
          error:
            "No se pudo completar la operación. Actualiza los datos y vuelve a intentarlo.",
        });
      }
    });
  }
  function load() {
    run(() => getCardOwnership(reference));
  }
  return (
    <details
      className="panel min-w-0 p-4"
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
        if (event.currentTarget.open && !pending) load();
      }}
    >
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-accent">
        Colección y deseos
      </summary>
      <div className="mt-3 grid min-w-0 gap-4" aria-busy={pending}>
        <p className="text-xs leading-5 text-muted">
          La lista virtual y los deseos no implican que poseas copias. Registra
          aquí tus cartas físicas; cada arte se guarda por separado.
        </p>
        {pending && (
          <p role="status" className="text-sm text-muted">
            Actualizando…
          </p>
        )}
        {message.error && (
          <p role="alert" className="text-sm text-red-200">
            {message.error}
          </p>
        )}
        {message.success && (
          <p role="status" className="text-sm text-green-200">
            {message.success}
          </p>
        )}
        <button
          type="button"
          className="button-secondary justify-self-start"
          disabled={pending}
          onClick={load}
        >
          Actualizar datos
        </button>
        {data && open && (
          <fieldset disabled={pending} className="grid min-w-0 gap-6">
            <section className="grid gap-4">
              <h3 className="font-semibold">Mis copias</h3>
              {data.items.length ? (
                data.items.map((item) => (
                  <div
                    key={item.id}
                    className="grid min-w-0 gap-3 rounded-xl border border-border p-3"
                  >
                    <p className="text-xs text-muted">
                      {item.language.toUpperCase()} · Reservadas:{" "}
                      {reservedQuantity(item.id, data.allocations)} · Libres:{" "}
                      {availableQuantity(item, data.allocations)}
                    </p>
                    <LotForm
                      key={item.updated_at}
                      item={item}
                      reference={reference}
                      run={run}
                    />
                    <button
                      type="button"
                      className="button-secondary text-red-200"
                      onClick={() => {
                        if (
                          window.confirm(
                            "¿Eliminar este lote físico? Debes liberar antes sus reservas.",
                          )
                        )
                          run(() =>
                            removeOwnershipRecord(reference, {
                              kind: "item",
                              id: item.id,
                              expected_updated_at: item.updated_at,
                              confirmed: true,
                            }),
                          );
                      }}
                    >
                      Eliminar lote
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">
                  Todavía no has registrado copias físicas de esta impresión.
                </p>
              )}
              <details>
                <summary className="min-h-11 cursor-pointer py-3 text-sm text-accent">
                  Añadir lote en inglés
                </summary>
                <div className="mt-3">
                  <LotForm
                    key={`new-${data.items.length}`}
                    reference={reference}
                    run={run}
                  />
                </div>
              </details>
            </section>
            <section className="grid gap-3">
              <h3 className="font-semibold">Mi deseo</h3>
              <p className="text-sm text-muted">
                Tienes{" "}
                {data.cardId
                  ? ownedPrintingQuantity(data.cardId, data.items)
                  : 0}{" "}
                copias en inglés de este arte.
              </p>
              <WishForm
                key={data.wish?.updated_at ?? "new-wish"}
                wish={data.wish}
                reference={reference}
                run={run}
              />
              {data.wish && (
                <button
                  type="button"
                  className="button-secondary text-red-200"
                  onClick={() => {
                    const wish = data.wish!;
                    if (
                      window.confirm(
                        "¿Quitar esta impresión de tu lista de deseos? Tus copias se conservarán.",
                      )
                    )
                      run(() =>
                        removeOwnershipRecord(reference, {
                          kind: "wish",
                          id: wish.id,
                          expected_updated_at: wish.updated_at,
                          confirmed: true,
                        }),
                      );
                  }}
                >
                  Quitar de deseos
                </button>
              )}
            </section>
          </fieldset>
        )}
      </div>
    </details>
  );
}

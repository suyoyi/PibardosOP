"use client";
import { addManualCard } from "@/app/(private)/actions";
import { colorLabels, typeLabels, type Card } from "@/domain/cards";
import { ActionForm, Field } from "./forms";
export function ManualCardForm({ catalog }: { catalog: Card[] }) {
  return (
    <ActionForm action={addManualCard} submit="Guardar carta manual">
      <p className="text-sm leading-6 text-muted">
        Copia los datos de tu carta física. Esta entrada será privada y se
        identificará como manual, sin verificación externa. No se descargan
        ilustraciones.
      </p>
      <Field label="Código de carta">
        <input
          name="card_number"
          className="field"
          required
          maxLength={40}
          placeholder="OP01-025"
        />
      </Field>
      <Field label="Nombre de carta">
        <input name="name" className="field" required maxLength={200} />
      </Field>
      <Field label="Tipo de carta">
        <select name="card_type" className="field">
          {Object.entries(typeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <fieldset>
        <legend className="field-label">Colores de carta</legend>
        <div className="flex flex-wrap gap-3">
          {Object.entries(colorLabels).map(([value, label]) => (
            <label
              key={value}
              className="flex min-h-12 items-center gap-2 rounded-lg border border-border px-3"
            >
              <input type="checkbox" name="colors" value={value} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            ["cost", "Coste"],
            ["power", "Poder"],
            ["counter", "Counter"],
            ["life", "Vida del líder"],
          ] as const
        ).map(([name, label]) => (
          <Field label={label} key={name} hint="Deja vacío si no aplica.">
            <input name={name} type="number" min={0} className="field" />
          </Field>
        ))}
      </div>
      <Field label="Colección">
        <input name="set_code" className="field" maxLength={30} />
      </Field>
      <Field label="Atributo">
        <input name="attribute" className="field" maxLength={100} />
      </Field>
      <Field label="Texto de efecto">
        <textarea
          name="effect_text"
          className="field"
          maxLength={10000}
          rows={3}
        />
      </Field>
      <Field label="Idioma">
        <select name="language" className="field" defaultValue="en">
          <option value="es">Español</option>
          <option value="en">Inglés</option>
          <option value="ja">Japonés</option>
        </select>
      </Field>
      <Field label="Impresión / variante">
        <input
          name="printing_code"
          className="field"
          required
          defaultValue="standard"
          maxLength={60}
        />
      </Field>
      <Field
        label="Identidad original (reimpresión)"
        hint="Comparte el límite de copias con la carta original. Para el mismo código se enlaza automáticamente."
      >
        <select name="canonical_card_id" className="field">
          <option value="">Nueva identidad o mismo código</option>
          {catalog
            .filter((c) => c.id === c.canonical_card_id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.card_number} · {c.name}
              </option>
            ))}
        </select>
      </Field>
    </ActionForm>
  );
}

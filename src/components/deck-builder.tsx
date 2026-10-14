"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  previewImport,
  saveDeck,
  type PreviewState,
} from "@/app/(private)/actions";
import { type Card, type CardFilters } from "@/domain/cards";
import { importedMainEntries, type DeckEntry } from "@/domain/deck-import";
import {
  validateDeck,
  standardRules,
  type Deck,
  type Restriction,
} from "@/domain/decks";
import { ActionForm, Field } from "./forms";
import { CardArtwork } from "./card-catalog";
import { DeckCardSearch } from "./deck-card-search";
export function ValidationMessages({
  result,
}: {
  result: ReturnType<typeof validateDeck>;
}) {
  return (
    <section aria-label="Validación del mazo" className="panel p-5">
      <h2 className="font-semibold">Mazo principal: {result.mainCount} / 50</h2>
      <p className="mt-2 text-sm text-muted">
        DON!! separado: {result.donCount} / 10 ·{" "}
        {result.constructionVerified
          ? "Construcción correcta"
          : result.validConstruction
            ? "Construcción pendiente de verificar"
            : "Construcción incompleta o inválida"}
      </p>
      <ul className="mt-4 grid gap-2 text-sm">
        {result.issues.map((issue, index) => (
          <li
            key={`${issue.code}-${index}`}
            className={
              issue.severity === "error" ? "text-red-200" : "text-amber-100"
            }
          >
            {issue.severity === "error" ? "Error" : "Aviso"}: {issue.message}
          </li>
        ))}
      </ul>
    </section>
  );
}
export function DeckBuilder({
  id,
  catalog: initialCatalog,
  restrictions,
  deck,
  initialEntries = [],
}: {
  id: string;
  catalog: Card[];
  restrictions: Restriction[];
  deck?: Deck;
  initialEntries?: DeckEntry[];
}) {
  const [catalog, setCatalog] = useState(initialCatalog);
  // React Hook Form owns the structured builder values; domain services and
  // the authenticated Server Action remain authoritative for validation.
  const { control, getValues, setValue } = useForm<{
    entries: DeckEntry[];
    leaderId: string;
    format: string;
  }>({
    defaultValues: {
      entries: initialEntries,
      leaderId: deck?.leader_card_id ?? "",
      format: deck?.format ?? "standard",
    },
  });
  const entries = useWatch({ control, name: "entries" }),
    leaderId = useWatch({ control, name: "leaderId" }),
    format = useWatch({ control, name: "format" });
  const setEntries = (
    next: DeckEntry[] | ((current: DeckEntry[]) => DeckEntry[]),
  ) =>
    setValue(
      "entries",
      typeof next === "function" ? next(getValues("entries")) : next,
      { shouldDirty: true },
    );
  const setLeaderId = (value: string) =>
    setValue("leaderId", value, { shouldDirty: true });
  const setFormat = (value: string) =>
    setValue("format", value, { shouldDirty: true });
  const [filters, setFilters] = useState<CardFilters>({}),
    [raw, setRaw] = useState(""),
    [preview, setPreview] = useState<PreviewState>({}),
    [previewPending, startPreview] = useTransition(),
    [confirmed, setConfirmed] = useState(false),
    [viewGrid, setViewGrid] = useState(false);
  const leader = catalog.find((c) => c.id === leaderId),
    result = validateDeck(
      leader,
      entries,
      catalog,
      restrictions,
      standardRules(format),
    );
  const report = preview.report,
    importedLeaders =
      report?.entries.filter((e) => e.card.card_type === "leader") ?? [];
  const blocked = Boolean(
    report &&
    (report.unknown.length ||
      report.malformed.length ||
      importedLeaders.length > 1 ||
      importedLeaders.some((e) => e.quantity !== 1)),
  );
  const changeQuantity = (card: Card, quantity: number) =>
    setEntries((current) =>
      quantity < 1
        ? current.filter((e) => e.card_id !== card.id)
        : current.some((e) => e.card_id === card.id)
          ? current.map((e) =>
              e.card_id === card.id
                ? { ...e, quantity: Math.min(50, quantity) }
                : e,
            )
          : [
              ...current,
              {
                card_id: card.id,
                quantity: Math.min(50, quantity),
                role: card.card_type === "don" ? "don" : "main",
              },
            ],
    );
  const selectCard = (card: Card) => {
    setCatalog((current) => [
      ...new Map([...current, card].map((c) => [c.id, c])).values(),
    ]);
    if (card.card_type === "leader") setLeaderId(card.id);
    else
      changeQuantity(
        card,
        (getValues("entries").find((e) => e.card_id === card.id)?.quantity ??
          0) + 1,
      );
  };
  const review = (resolveMissing = false) =>
    startPreview(async () => {
      const next = await previewImport(raw, resolveMissing);
      setPreview(next);
      setConfirmed(false);
      if (next.report) {
        const received = next.report.entries.map((e) => e.card);
        setCatalog((current) => [
          ...new Map([...current, ...received].map((c) => [c.id, c])).values(),
        ]);
      }
      if (
        next.report &&
        !next.report.unknown.length &&
        !next.report.malformed.length
      ) {
        const leaders = next.report.entries.filter(
          (e) => e.card.card_type === "leader",
        );
        if (leaders.length <= 1 && leaders.every((e) => e.quantity === 1)) {
          setEntries(importedMainEntries(next.report));
          if (leaders[0]) setLeaderId(leaders[0].card.id);
        }
      }
    });
  return (
    <div className="grid gap-6">
      <DeckCardSearch
        catalog={catalog}
        filters={filters}
        onFilters={setFilters}
        onSelect={selectCard}
      />
      <section className="panel grid gap-4 p-5" aria-label="Importar lista">
        <h2 className="text-lg font-semibold">Importar lista de texto</h2>
        <p className="text-sm text-muted">
          Acepta 4 OP01-025, 4x OP01-025 y OP01-025 x4. Las líneas con # son
          comentarios. Una importación reconocida sustituye el contenido del
          editor; no se guarda hasta tu confirmación.
        </p>
        <Field label="Lista de texto">
          <textarea
            className="field font-mono text-sm"
            rows={7}
            maxLength={100000}
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setPreview((current) => ({ jobId: current.jobId }));
              setConfirmed(false);
            }}
          />
        </Field>
        <button
          type="button"
          onClick={() => review()}
          disabled={previewPending || !raw.trim()}
          className="button-secondary"
        >
          {previewPending ? "Revisando…" : "Revisar importación"}
        </button>
        {Boolean(report?.unknown.length) && (
          <button
            type="button"
            className="button-secondary"
            disabled={previewPending}
            onClick={() => review(true)}
          >
            Resolver desconocidas con OPTCG API
          </button>
        )}
        {preview.providerNotice && (
          <p role="status" className="text-sm text-amber-100">
            {preview.providerNotice}
          </p>
        )}
        {preview.error && (
          <p role="alert" className="text-red-200">
            {preview.error}
          </p>
        )}
        {report && (
          <div aria-live="polite" className="grid gap-3">
            <h3 className="font-semibold">
              Vista previa · {report.entries.length} cartas reconocidas
            </h3>
            <ul className="grid gap-1 text-sm">
              {report.entries.map((e) => (
                <li key={e.card.id}>
                  {e.quantity} × {e.card.card_number} · {e.card.name}
                </li>
              ))}
            </ul>
            {report.duplicates.length > 0 && (
              <p className="text-sm text-amber-100">
                Duplicadas agrupadas:{" "}
                {report.duplicates
                  .map(
                    (e) =>
                      `${e.card_number} (${e.quantity} copias, líneas ${e.lines.join(", ")})`,
                  )
                  .join("; ")}
                .
              </p>
            )}
            {[...report.unknown, ...report.malformed].map((e) => (
              <p
                key={`${e.code}-${e.line}`}
                role="alert"
                className="break-words text-sm text-red-200"
              >
                Línea {e.line}: «{e.raw}» · {e.message}
              </p>
            ))}
            {(importedLeaders.length > 1 ||
              importedLeaders.some((e) => e.quantity !== 1)) && (
              <p role="alert" className="text-sm text-red-200">
                La lista debe contener un único líder con cantidad 1.
              </p>
            )}
            {blocked && (
              <p className="text-sm">
                <Link
                  href="/cards/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline"
                >
                  Añadir carta en otra pestaña
                </Link>
                . Después vuelve y pulsa Revisar importación; si hace falta,
                recarga tras copiar el texto.
              </p>
            )}
          </div>
        )}
      </section>
      <ValidationMessages result={result} />
      <ActionForm action={saveDeck} submit="Guardar mazo">
        <input type="hidden" name="id" value={id} />
        <input
          type="hidden"
          name="expected_version_id"
          value={deck?.current_version_id ?? ""}
        />
        <input type="hidden" name="cards" value={JSON.stringify(entries)} />
        <input type="hidden" name="raw_input" value={raw} />
        <input
          type="hidden"
          name="import_job_id"
          value={report ? preview.jobId : ""}
        />
        <Field label="Nombre del mazo">
          <input
            name="name"
            className="field"
            required
            defaultValue={deck?.name ?? ""}
            maxLength={120}
          />
        </Field>
        <Field label="Líder del mazo">
          <select
            name="leader_card_id"
            className="field"
            required
            value={leaderId}
            onChange={(e) => setLeaderId(e.target.value)}
          >
            <option value="">Seleccionar líder</option>
            {catalog
              .filter((c) => c.card_type === "leader")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.card_number} · {c.name}
                </option>
              ))}
          </select>
        </Field>
        {leader && (
          <div className="flex items-center gap-3">
            <CardArtwork card={leader} small />
            <p className="text-sm">{leader.name}</p>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Formato">
            <input
              name="format"
              className="field"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              required
              maxLength={60}
            />
          </Field>
          <Field label="Estado">
            <select
              name="status"
              className="field"
              defaultValue={deck?.status ?? "draft"}
            >
              <option value="draft">Borrador</option>
              <option value="active">Activo (construcción válida)</option>
              <option value="archived">Archivado</option>
            </select>
          </Field>
        </div>
        <Field label="Descripción">
          <textarea
            name="description"
            className="field"
            rows={3}
            maxLength={10000}
            defaultValue={deck?.description ?? ""}
          />
        </Field>
        <Field label="Etiquetas" hint="Separadas por comas.">
          <input
            name="tags"
            className="field"
            maxLength={820}
            defaultValue={deck?.tags.join(", ") ?? ""}
          />
        </Field>
        <Field
          label="Nota de la versión"
          hint="Se guarda al crear una versión por cambios de líder, formato o cartas."
        >
          <textarea
            name="notes"
            className="field"
            rows={2}
            maxLength={10000}
            placeholder="Qué has cambiado y por qué"
          />
        </Field>
        {report && (
          <label className="flex min-h-12 items-center gap-3 text-sm">
            <input
              name="confirm_import"
              type="checkbox"
              checked={confirmed}
              disabled={blocked}
              onChange={(e) => setConfirmed(e.target.checked)}
              required
            />
            He revisado las cantidades, las duplicadas y los avisos de la
            importación.
          </label>
        )}
      </ActionForm>
      <section className="panel grid gap-5 p-5" aria-label="Contenido del mazo">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Contenido del editor</h2>
          <button
            className="button-secondary"
            type="button"
            onClick={() => setViewGrid(!viewGrid)}
          >
            {viewGrid ? "Ver lista compacta" : "Ver cuadrícula"}
          </button>
        </div>
        {entries.length ? (
          <ul
            className={
              viewGrid ? "grid grid-cols-2 gap-3 lg:grid-cols-3" : "grid gap-3"
            }
          >
            {entries.map((entry) => {
              const card = catalog.find((c) => c.id === entry.card_id);
              if (!card) return null;
              return (
                <li
                  key={card.id}
                  className={`rounded-xl border border-border p-3 ${viewGrid ? "grid gap-3" : "flex flex-wrap items-center gap-3"}`}
                >
                  <CardArtwork card={card} small={!viewGrid} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-accent">
                      {card.card_number} ·{" "}
                      {entry.role === "don" ? "DON!! separado" : "Principal"}
                    </p>
                    <h3 className="break-words text-sm font-semibold">
                      {card.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="button-secondary px-4"
                      aria-label={`Quitar una ${card.card_number}`}
                      onClick={() => changeQuantity(card, entry.quantity - 1)}
                    >
                      −
                    </button>
                    <input
                      aria-label={`Cantidad ${card.card_number}`}
                      type="number"
                      min={0}
                      max={50}
                      className="field w-16 px-2 text-center"
                      value={entry.quantity}
                      onChange={(e) =>
                        changeQuantity(card, Number(e.target.value))
                      }
                    />
                    <button
                      type="button"
                      className="button-secondary px-4"
                      aria-label={`Añadir una ${card.card_number}`}
                      onClick={() => changeQuantity(card, entry.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">
            Busca cartas arriba para añadirlas o importa una lista.
          </p>
        )}
      </section>
    </div>
  );
}

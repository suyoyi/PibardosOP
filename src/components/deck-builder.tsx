"use client";
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
import {
  builderMaximumQuantity,
  compatibleWithLeader,
} from "@/domain/deck-builder";
export function ValidationMessages({
  result,
}: {
  result: ReturnType<typeof validateDeck>;
}) {
  return (
    <section aria-label="Validación del mazo" className="panel p-5">
      <h2 className="font-semibold">Revisa tu lista</h2>
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
  mode = "create",
}: {
  id: string;
  catalog: Card[];
  restrictions: Restriction[];
  deck?: Deck;
  mode?: "create" | "import";
  initialEntries?: DeckEntry[];
}) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const wizard = !deck;
  const [step, setStep] = useState(0);
  const [selectingLeader, setSelectingLeader] = useState(false);
  const [adjustmentNotice, setAdjustmentNotice] = useState("");
  const [metadata, setMetadata] = useState({
    name: deck?.name ?? "",
    description: deck?.description ?? "",
    tags: deck?.tags.join(", ") ?? "",
  });
  const updateMetadata = (key: keyof typeof metadata, value: string) =>
    setMetadata((current) => ({ ...current, [key]: value }));
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
    [confirmed, setConfirmed] = useState(false);
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
    setEntries((current) => {
      const own =
        current.find((entry) => entry.card_id === card.id)?.quantity ?? 0;
      if (!Number.isSafeInteger(quantity) || quantity < 0) return current;
      if (
        quantity > own &&
        (!compatibleWithLeader(
          card,
          catalog.find((item) => item.id === getValues("leaderId")),
        ) ||
          quantity > builderMaximumQuantity(card, current, [...catalog, card]))
      ) {
        setAdjustmentNotice(
          "No se puede añadir: revisa el color, el máximo de 4 copias entre variantes o el tamaño del mazo.",
        );
        return current;
      }
      setAdjustmentNotice("");
      return quantity < 1
        ? current.filter((entry) => entry.card_id !== card.id)
        : own
          ? current.map((entry) =>
              entry.card_id === card.id ? { ...entry, quantity } : entry,
            )
          : [
              ...current,
              {
                card_id: card.id,
                quantity,
                role: card.card_type === "don" ? "don" : "main",
              },
            ];
    });
  const adjustCard = (card: Card, delta: number) => {
    setCatalog((current) => [
      ...new Map([...current, card].map((c) => [c.id, c])).values(),
    ]);
    if (card.card_type === "leader") {
      setLeaderId(card.id);
      setSelectingLeader(false);
      setFilters({});
      if (wizard) setStep(1);
    } else
      changeQuantity(
        card,
        (getValues("entries").find((e) => e.card_id === card.id)?.quantity ??
          0) + delta,
      );
  };
  const selectCard = (card: Card) => adjustCard(card, 1);
  const review = () =>
    startPreview(async () => {
      const next = await previewImport(raw, true);
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
          if (leaders[0]) {
            setLeaderId(leaders[0].card.id);
            if (wizard && mode !== "import") setStep(1);
          }
        }
      }
    });
  return (
    <div className="grid gap-6">
      {wizard && (
        <nav aria-label="Pasos para crear el mazo">
          <ol className="grid grid-cols-3 gap-2">
            {[mode === "import" ? "Lista" : "Líder", "Cartas", "Nombre"].map(
              (label, index) => (
                <li key={label}>
                  <button
                    type="button"
                    className={`picker-tab w-full ${step === index ? "picker-tab-active" : ""}`}
                    aria-current={step === index ? "step" : undefined}
                    disabled={index > step && (index !== 1 || !leader)}
                    onClick={() => {
                      setStep(index);
                      setFilters({});
                    }}
                  >
                    {index + 1}. {label}
                  </button>
                </li>
              ),
            )}
          </ol>
        </nav>
      )}
      {(!wizard || (step < 2 && (mode !== "import" || step > 0))) && (
        <DeckCardSearch
          catalog={catalog}
          filters={filters}
          onFilters={setFilters}
          onSelect={selectCard}
          onAdjust={adjustCard}
          entries={entries}
          leaderId={leaderId}
          leaderActions={
            wizard && step === 1 ? (
              <>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    setSelectingLeader(true);
                    setFilters({});
                  }}
                >
                  Cambiar líder
                </button>
                <button
                  type="button"
                  className="button-primary"
                  disabled={blocked || !leader || previewPending}
                  onClick={() => setStep(2)}
                >
                  Continuar al nombre
                </button>
              </>
            ) : undefined
          }
          mainCount={result.mainCount}
          mode={
            wizard
              ? step === 0 || !leader || selectingLeader
                ? "leader"
                : "cards"
              : undefined
          }
        />
      )}
      {adjustmentNotice && (
        <p role="alert" className="text-sm text-amber-100">
          {adjustmentNotice}
        </p>
      )}
      {mode === "import" && wizard && step === 0 && (
        <section className="panel p-5" aria-label="Importar lista">
          <h2 className="text-lg font-semibold">Importar lista de texto</h2>
          <div className="mt-4 grid gap-4">
            <p className="text-sm text-muted">
              Acepta 4 OP01-025, 4xOP01-025 y OP01-025 x4. Las cartas que falten
              se consultan en OPTCG API al revisar. Las líneas con # son
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
                onClick={() => review()}
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
                    Corrige las líneas señaladas o vuelve a consultar las cartas
                    pendientes. La lista permanece aquí y no se guarda hasta tu
                    confirmación.
                  </p>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            className="button-primary mt-5"
            disabled={!report || blocked || previewPending}
            onClick={() => setStep(1)}
          >
            Continuar con la lista
          </button>
        </section>
      )}
      {(!wizard || step === 2) && <ValidationMessages result={result} />}
      {(!wizard || step === 2) && (
        <>
          {wizard && (
            <div className="panel flex items-center gap-4 p-5">
              {leader && <CardArtwork card={leader} small />}
              <div>
                <h2 className="font-semibold">Ponle nombre a tu estrategia</h2>
                <p className="mt-2 text-sm text-muted">
                  {leader?.name} · {result.mainCount}/50 cartas
                </p>
                <button
                  type="button"
                  className="home-text-link"
                  onClick={() => setStep(1)}
                >
                  Volver a las cartas
                </button>
              </div>
            </div>
          )}
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
                value={metadata.name}
                onChange={(event) => updateMetadata("name", event.target.value)}
                maxLength={120}
              />
            </Field>
            {wizard ? (
              <input type="hidden" name="leader_card_id" value={leaderId} />
            ) : (
              <Field label="Líder del mazo">
                <select
                  name="leader_card_id"
                  className="field"
                  required
                  value={leaderId}
                  onChange={(event) => {
                    setLeaderId(event.target.value);
                    setFilters({});
                  }}
                >
                  <option value="">Seleccionar líder</option>
                  {catalog
                    .filter(
                      (card) =>
                        card.card_type === "leader" &&
                        (card.language === "en" || card.id === leaderId),
                    )
                    .map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.card_number} · {card.name}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            <details open={!wizard}>
              <summary className="min-h-11 cursor-pointer text-sm text-accent">
                Opciones del mazo
              </summary>
              <div className="mt-4 grid gap-5">
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
                </div>
                <Field label="Descripción">
                  <textarea
                    name="description"
                    className="field"
                    rows={3}
                    maxLength={10000}
                    value={metadata.description}
                    onChange={(event) =>
                      updateMetadata("description", event.target.value)
                    }
                  />
                </Field>
                <Field label="Etiquetas" hint="Separadas por comas.">
                  <input
                    name="tags"
                    className="field"
                    maxLength={820}
                    value={metadata.tags}
                    onChange={(event) =>
                      updateMetadata("tags", event.target.value)
                    }
                  />
                </Field>
              </div>
            </details>
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
        </>
      )}
    </div>
  );
}

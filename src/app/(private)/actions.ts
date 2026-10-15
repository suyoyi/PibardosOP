"use server";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { getCatalog, getDeckWorkspace } from "@/lib/data";
import {
  parseDecklist,
  normalizeDeckText,
  type ImportReport,
} from "@/domain/deck-import";
import { validateDeck, standardRules } from "@/domain/decks";
import {
  deckSchema,
  manualCardSchema,
  matchSchema,
  tournamentSchema,
  uuid,
  validationMessage,
  type ActionState,
} from "@/domain/forms";
import { OptcgProvider, optcgClient } from "@/lib/optcg";
import { OptcgError, selectDefaultOptcgPrinting } from "@/domain/optcg";
import type { Json } from "@/lib/supabase/database.types";

function databaseError(error: {
  code?: string;
  message?: string;
}): ActionState {
  if (error.message?.includes("STALE_VERSION"))
    return {
      error:
        "Otra pestaña guardó una versión más reciente. Copia tus cambios y recarga antes de guardar.",
    };
  if (error.code === "23505")
    return {
      error:
        "Ya existe esa impresión o número de ronda. Comprueba el catálogo o el torneo.",
    };
  if (error.code === "23503")
    return {
      error:
        "No se pudo completar la operación: hay registros relacionados. Revisa las referencias y los datos vinculados.",
    };
  if (error.message?.includes("Event version has recorded matches"))
    return {
      error:
        "El torneo ya tiene partidas: su versión de mazo no se puede cambiar.",
    };
  if (error.message?.includes("Event") || error.message?.includes("event"))
    return {
      error:
        "El torneo debe estar activo y coincidir con la versión y el formato de la partida.",
    };
  return {
    error:
      "No se pudo guardar. Revisa los datos y la conexión; tus cambios siguen en el formulario.",
  };
}
function finish(path: string): never {
  revalidatePath("/", "layout");
  redirect(`${path}?saved=1`);
}

export async function addManualCard(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const parsed = manualCardSchema.safeParse({
    ...Object.fromEntries(form),
    colors: form.getAll("colors"),
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };
  const { canonical_card_id, ...card } = parsed.data;
  const catalog = await getCatalog(supabase);
  const sameNumberRoot = catalog.find(
    (c) => c.card_number === card.card_number && c.id === c.canonical_card_id,
  );
  const canonical = canonical_card_id || sameNumberRoot?.id;
  if (
    canonical &&
    !catalog.some(
      (c) =>
        c.id === canonical &&
        c.id === c.canonical_card_id &&
        c.card_type === card.card_type,
    )
  )
    return {
      error:
        "La identidad original debe ser una carta disponible del mismo tipo.",
    };
  const id = randomUUID();
  const { error } = await supabase.from("cards").insert({
    ...card,
    id,
    user_id: user.id,
    canonical_card_id: canonical || id,
    source: "manual",
    set_code: card.set_code || null,
    attribute: card.attribute || null,
    effect_text: card.effect_text || null,
  });
  if (error) return databaseError(error);
  finish("/cards");
}

export type PreviewState = {
  error?: string;
  report?: ImportReport;
  jobId?: string;
  raw?: string;
  providerNotice?: string;
};
export async function previewImport(
  raw: string,
  resolveMissing = false,
): Promise<PreviewState> {
  const { supabase } = await requireUser();
  if (typeof raw !== "string" || raw.length > 100000 || !raw.trim())
    return { error: "Pega una lista de hasta 100.000 caracteres." };
  raw = normalizeDeckText(raw);
  let report = parseDecklist(raw, await getCatalog(supabase));
  let providerNotice: string | undefined;
  if (resolveMissing === true) {
    const numbers = [
      ...new Set(
        report.unknown
          .map((p) => p.card_number)
          .filter((n): n is string => Boolean(n)),
      ),
    ];
    const client = optcgClient(),
      provider = new OptcgProvider(supabase, undefined, client);
    const notices: string[] = [];
    // Use the documented base printing when present; never guess ambiguous variants.
    for (const number of numbers.slice(0, 15)) {
      try {
        const matches = await client.cards(number);
        notices.push(...matches.issues);
        const selected = selectDefaultOptcgPrinting(matches.cards, number);
        if (!selected) {
          notices.push(
            `${number}: sin una coincidencia única. Selecciona la impresión en Cartas o añádela manualmente.`,
          );
          continue;
        }
        await provider.save(selected);
      } catch (e) {
        notices.push(
          e instanceof OptcgError
            ? e.message
            : "No se pudo consultar el proveedor; conserva la lista y reintenta.",
        );
        if (!(e instanceof OptcgError) || e.code !== "NOT_FOUND") break;
      }
    }
    if (numbers.length > 15)
      notices.push(
        "Se consultan hasta 15 códigos por revisión. Repite para continuar sin agotar la cuota.",
      );
    report = parseDecklist(raw, await getCatalog(supabase));
    providerNotice = notices.length
      ? notices.join(" ")
      : "Cartas consultadas. Revisa la impresión y las cantidades antes de confirmar; el mazo todavía no se ha guardado.";
    revalidatePath("/", "layout");
  }
  const id = randomUUID();
  const { error } = await supabase.from("import_jobs").insert({
    id,
    source: "text",
    status: "preview",
    raw_input: raw,
    error_report: [
      ...report.unknown,
      ...report.malformed,
      ...report.duplicates,
      ...(providerNotice
        ? [{ code: "PROVIDER_NOTICE", message: providerNotice }]
        : []),
    ] as unknown as Json[],
  });
  if (error) return databaseError(error);
  return { report, jobId: id, raw, providerNotice };
}

export async function saveDeck(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  let cards: unknown;
  try {
    cards = JSON.parse(String(form.get("cards") ?? ""));
  } catch {
    return { error: "La lista de cartas no es válida." };
  }
  const parsed = deckSchema.safeParse({
    ...Object.fromEntries(form),
    status: "draft",
    notes: "",
    cards,
    tags: String(form.get("tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };
  const workspace = await getDeckWorkspace(supabase),
    input = parsed.data;
  const leader = workspace.catalog.find(
    (card) => card.id === input.leader_card_id,
  );
  const validation = validateDeck(
    leader,
    input.cards,
    workspace.catalog,
    workspace.restrictions,
    standardRules(input.format),
  );
  const fatal = validation.issues.filter((issue) =>
    [
      "LEADER",
      "UNKNOWN_CARD",
      "MAIN_TYPE",
      "DON_TYPE",
      "QUANTITY",
      "DUPLICATE_PRINTING",
      "COPY_LIMIT",
    ].includes(issue.code),
  );
  if (fatal.length)
    return { error: fatal.map((issue) => issue.message).join(" ") };
  const importJob = String(form.get("import_job_id") ?? ""),
    raw = normalizeDeckText(String(form.get("raw_input") ?? ""));
  if (importJob) {
    if (
      !uuid.safeParse(importJob).success ||
      form.get("confirm_import") !== "on"
    )
      return {
        error: "Confirma la revisión de la importación antes de guardar.",
      };
    const report = parseDecklist(raw, workspace.catalog),
      leaders = report.entries.filter((e) => e.card.card_type === "leader");
    if (
      report.unknown.length ||
      report.malformed.length ||
      leaders.length > 1 ||
      leaders.some((e) => e.quantity !== 1)
    )
      return {
        error:
          "Corrige las líneas desconocidas o inválidas y vuelve a revisar la importación.",
      };
  } else if (raw.trim())
    return { error: "Revisa y confirma la lista pegada antes de guardarla." };
  const { data, error } = await supabase.rpc("save_deck", {
    p_input: { ...input, import_job_id: importJob, raw_input: raw },
  });
  if (error) return databaseError(error);
  finish(`/decks/${data}`);
}

export async function deckOperation(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const id = String(form.get("id") ?? ""),
    operation = form.get("operation");
  if (!uuid.safeParse(id).success) return { error: "Mazo no válido." };
  const workspace = await getDeckWorkspace(supabase),
    deck = workspace.decks.find((d) => d.id === id);
  if (!deck) return { error: "Mazo no disponible." };
  if (operation === "delete" && form.get("confirmed") === "yes") {
    const { error } = await supabase.from("decks").delete().eq("id", id);
    if (error?.code === "23503")
      return {
        error:
          "No se puede eliminar: hay partidas o torneos vinculados. Sus registros se conservan; elimina primero esas referencias si quieres borrar el mazo.",
      };
    if (error) return databaseError(error);
    finish("/decks");
  }
  return { error: "Confirma la operación." };
}

export async function saveMatch(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const parsed = matchSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: validationMessage(parsed.error) };
  const { data, error } = await supabase.rpc("save_match", {
    p_input: parsed.data,
  });
  if (error) return databaseError(error);
  if (!data) return { error: "No se pudo guardar la partida." };
  finish(
    parsed.data.tournament_id
      ? `/tournaments/${parsed.data.tournament_id}`
      : "/matches",
  );
}
export async function deleteMatch(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const id = String(form.get("id") ?? "");
  if (!uuid.safeParse(id).success || form.get("confirmed") !== "yes")
    return { error: "Confirma la eliminación de la partida." };
  const { error } = await supabase.from("matches").delete().eq("id", id);
  if (error) return databaseError(error);
  finish("/matches");
}
export async function saveTournament(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const parsed = tournamentSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: validationMessage(parsed.error) };
  const { error } = await supabase
    .from("tournaments")
    .upsert({ ...parsed.data, location: parsed.data.location || null });
  if (error) return databaseError(error);
  finish(`/tournaments/${parsed.data.id}`);
}
export async function archiveTournament(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const id = String(form.get("id") ?? "");
  if (!uuid.safeParse(id).success || form.get("confirmed") !== "yes")
    return { error: "Confirma el archivo del torneo." };
  const { error } = await supabase
    .from("tournaments")
    .update({
      archived_at:
        form.get("restore") === "yes" ? null : new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return databaseError(error);
  finish(`/tournaments/${id}`);
}

"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { ManualCatalogProvider, readAll, type AppClient } from "@/lib/data";
import { getOptcgBuilderCard } from "@/app/(private)/cards/optcg-actions";
import {
  cardReferenceSchema,
  type CardReference,
} from "@/domain/card-reference";
import {
  inventorySchema,
  wishSchema,
  deckCollectionNeeds,
  planDeckAllocations,
  ownedPrintingQuantity,
} from "@/domain/collection";
import { getCollectionWorkspace, deckRequirements } from "@/lib/collection";
import type { ActionState } from "@/domain/forms";

function fail(error?: { code?: string; message?: string }) {
  const message = error?.message ?? "";
  if (message.includes("STALE_VERSION"))
    return {
      error: "La versión del mazo ha cambiado. Actualiza antes de reservar.",
    };
  if (
    message.includes("Allocated copies") ||
    message.includes("Release physical")
  )
    return {
      error:
        "Libera primero las reservas. Estas copias están asignadas a mazos físicos.",
    };
  if (message.includes("Insufficient unallocated"))
    return {
      error:
        "Ya no quedan suficientes copias libres. Actualiza la colección y vuelve a intentarlo.",
    };
  if (error?.code === "23505")
    return {
      error:
        "Ya existe un lote o deseo para esos datos. Actualiza y edita el existente.",
    };
  return {
    error:
      "No se pudo guardar. Revisa los datos y actualiza el estado antes de reintentar.",
  };
}
function refresh() {
  revalidatePath("/collection");
  revalidatePath("/wishlist");
}
async function resolve(
  db: AppClient,
  owner: string,
  ref: CardReference,
  create = false,
) {
  if (ref.kind === "saved")
    return new ManualCatalogProvider(db).getCard(ref.id);
  const { data, error } = await db
    .from("cards")
    .select("*")
    .eq("user_id", owner)
    .eq("source", "optcgapi")
    .eq("provider_card_id", ref.external_id)
    .eq("card_number", ref.card_number)
    .maybeSingle();
  if (error) throw new Error("Card read failed");
  if (data || !create) return data;
  const selected = await getOptcgBuilderCard(ref);
  if (!selected.card) throw new Error("Card unavailable");
  return selected.card;
}
async function state(db: AppClient, cardId: string | null) {
  if (!cardId) return { cardId, items: [], allocations: [], wish: null };
  const [items, { data: wish, error }] = await Promise.all([
    readAll((a, b) =>
      db
        .from("collection_items")
        .select("*")
        .eq("card_id", cardId)
        .order("id")
        .range(a, b),
    ),
    db.from("wishlist_items").select("*").eq("card_id", cardId).maybeSingle(),
  ]);
  if (error) throw new Error("Wishlist read failed");
  // Read via RLS with full pagination. No private rows enter a public cache.
  const all = items.length
    ? await readAll((a, b) =>
        db.from("collection_allocations").select("*").order("id").range(a, b),
      )
    : [];
  const ids = new Set(items.map((i) => i.id));
  return {
    cardId,
    items,
    allocations: all.filter((a) => ids.has(a.collection_item_id)),
    wish,
  };
}
export async function getCardOwnership(input: unknown) {
  const { supabase, user } = await requireUser(),
    ref = cardReferenceSchema.safeParse(input);
  if (!ref.success) return { error: "Selecciona una carta válida." };
  try {
    const card = await resolve(supabase, user.id, ref.data);
    return { state: await state(supabase, card?.id ?? null) };
  } catch {
    return fail();
  }
}
export type CardOwnershipState = Awaited<ReturnType<typeof state>>;

export async function saveCollectionItem(reference: unknown, input: unknown) {
  const { supabase, user } = await requireUser(),
    ref = cardReferenceSchema.safeParse(reference),
    parsed = inventorySchema.safeParse(input);
  if (!ref.success || !parsed.success)
    return {
      error:
        "Revisa cantidades, acabado y ubicación. Las copias para intercambio no pueden superar las que tienes.",
    };
  try {
    const card = await resolve(supabase, user.id, ref.data, true);
    if (!card) return { error: "No se pudo recuperar la carta seleccionada." };
    const { id, expected_updated_at, ...values } = parsed.data;
    if (expected_updated_at) {
      const { data, error } = await supabase
        .from("collection_items")
        .update(values)
        .eq("id", id)
        .eq("card_id", card.id)
        .eq("updated_at", expected_updated_at)
        .select("id")
        .maybeSingle();
      if (error) return fail(error);
      if (!data)
        return {
          error:
            "Este lote cambió en otra pestaña. Copia tus cambios antes de actualizar sus datos.",
        };
    } else {
      const { data: prior } = await supabase
        .from("collection_items")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (prior) {
        if (
          prior.card_id !== card.id ||
          Object.entries(values).some(
            ([k, v]) => prior[k as keyof typeof prior] !== v,
          )
        )
          return {
            error:
              "El lote ya existe con otros datos. Actualiza antes de reintentar.",
          };
      } else {
        const { error } = await supabase.from("collection_items").insert({
          id,
          user_id: user.id,
          card_id: card.id,
          language: "en",
          ...values,
        });
        if (error) return fail(error);
      }
    }
    refresh();
    return {
      success: "Colección actualizada.",
      state: await state(supabase, card.id),
    };
  } catch {
    return fail();
  }
}
export async function saveWish(reference: unknown, input: unknown) {
  const { supabase, user } = await requireUser(),
    ref = cardReferenceSchema.safeParse(reference),
    parsed = wishSchema.safeParse(input);
  if (!ref.success || !parsed.success)
    return {
      error:
        "Indica un objetivo de 1 a 9999 copias, una prioridad y notas de hasta 3000 caracteres.",
    };
  try {
    const card = await resolve(supabase, user.id, ref.data, true);
    if (!card) return { error: "No se pudo recuperar la carta seleccionada." };
    const { id, expected_updated_at, ...values } = parsed.data;
    if (expected_updated_at) {
      const { data, error } = await supabase
        .from("wishlist_items")
        .update(values)
        .eq("id", id)
        .eq("card_id", card.id)
        .eq("updated_at", expected_updated_at)
        .select("id")
        .maybeSingle();
      if (error) return fail(error);
      if (!data)
        return {
          error:
            "Este deseo cambió en otra pestaña. Copia tus notas antes de actualizar sus datos.",
        };
    } else {
      const { data: prior } = await supabase
        .from("wishlist_items")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (prior) {
        if (
          prior.card_id !== card.id ||
          Object.entries(values).some(
            ([k, v]) => prior[k as keyof typeof prior] !== v,
          )
        )
          return { error: "El deseo cambió. Actualiza antes de reintentar." };
      } else {
        const { error } = await supabase
          .from("wishlist_items")
          .insert({ id, user_id: user.id, card_id: card.id, ...values });
        if (error) return fail(error);
      }
    }
    refresh();
    return {
      success: "Lista de deseos actualizada.",
      state: await state(supabase, card.id),
    };
  } catch {
    return fail();
  }
}
export async function removeOwnershipRecord(
  reference: unknown,
  input: unknown,
) {
  const { supabase, user } = await requireUser(),
    ref = cardReferenceSchema.safeParse(reference),
    parsed = z
      .object({
        kind: z.enum(["item", "wish"]),
        id: z.uuid(),
        expected_updated_at: z.string().min(1).max(60),
        confirmed: z.literal(true),
      })
      .strict()
      .safeParse(input);
  if (!ref.success || !parsed.success)
    return { error: "Confirma la eliminación del registro." };
  try {
    const card = await resolve(supabase, user.id, ref.data);
    if (!card) return { error: "El registro ya no está disponible." };
    const { data, error } = await supabase
      .from(parsed.data.kind === "item" ? "collection_items" : "wishlist_items")
      .delete()
      .eq("id", parsed.data.id)
      .eq("card_id", card.id)
      .eq("updated_at", parsed.data.expected_updated_at)
      .select("id")
      .maybeSingle();
    if (error) return fail(error);
    if (!data)
      return {
        error: "El registro ha cambiado o ya no existe. Actualiza sus datos.",
      };
    refresh();
    return {
      success: "Registro eliminado.",
      state: await state(supabase, card.id),
    };
  } catch {
    return fail();
  }
}
export async function reserveDeck(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser(),
    id = z.uuid().safeParse(form.get("deck_id")),
    version = z.uuid().safeParse(form.get("version_id"));
  if (!id.success || !version.success)
    return { error: "Selecciona un mazo y una versión válidos." };
  try {
    const w = await getCollectionWorkspace(supabase),
      d = deckRequirements(w, id.data);
    if (d.version.id !== version.data)
      return fail({ message: "STALE_VERSION" });
    const release = form.get("release") === "yes";
    if (release && form.get("confirmed") !== "yes")
      return { error: "Confirma la liberación de reservas." };
    const entries = release
      ? []
      : planDeckAllocations(
          id.data,
          d.requirements,
          w.catalog,
          w.items,
          w.allocations,
        );
    const { error } = await supabase.rpc("set_deck_allocations", {
      p_deck_id: id.data,
      p_version_id: version.data,
      p_entries: entries,
    });
    if (error) return fail(error);
    refresh();
    return {
      success: release
        ? "Reservas liberadas. Tus copias siguen en la colección."
        : "Reservas ajustadas a la versión seleccionada con las copias disponibles.",
    };
  } catch {
    return fail();
  }
}
export async function wishMissingCard(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser(),
    input = z
      .object({ deck_id: z.uuid(), version_id: z.uuid(), card_id: z.uuid() })
      .safeParse(Object.fromEntries(form));
  if (!input.success)
    return { error: "Revisa el mazo y la carta seleccionada." };
  try {
    const w = await getCollectionWorkspace(supabase),
      d = deckRequirements(w, input.data.deck_id);
    if (d.version.id !== input.data.version_id)
      return fail({ message: "STALE_VERSION" });
    const need = deckCollectionNeeds(
      d.deck.id,
      d.requirements,
      w.catalog,
      w.items,
      w.allocations,
    ).find((n) => n.card.id === input.data.card_id);
    if (!need?.missing)
      return {
        error:
          "Esta carta ya está disponible para el mazo. Actualiza la colección.",
      };
    const target = ownedPrintingQuantity(need.card.id, w.items) + need.missing;
    if (target > 9999)
      return { error: "El objetivo supera el máximo de 9999 copias." };
    const { error } = await supabase.rpc("raise_wishlist_target", {
      p_card_id: need.card.id,
      p_target: target,
    });
    if (error) return fail(error);
    refresh();
    return {
      success:
        "Faltantes añadidas a deseos para esta impresión, sin reducir un objetivo previo.",
    };
  } catch {
    return fail();
  }
}

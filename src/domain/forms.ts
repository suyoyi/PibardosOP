import { z } from "zod";
export type ActionState = { error?: string; success?: string };
export const uuid = z.uuid();
const shortText = (max: number) => z.string().trim().max(max);
export const entriesSchema = z
  .array(
    z.object({
      card_id: uuid,
      quantity: z.number().int().min(1).max(50),
      role: z.enum(["main", "don"]),
    }),
  )
  .max(100)
  .refine(
    (entries) => new Set(entries.map((e) => e.card_id)).size === entries.length,
    "Hay impresiones duplicadas.",
  );
export const deckSchema = z.object({
  id: uuid,
  expected_version_id: z.union([uuid, z.literal("")]),
  name: shortText(120).min(1),
  leader_card_id: uuid,
  description: shortText(10000),
  format: shortText(60).min(1),
  status: z.enum(["draft", "active", "archived"]),
  tags: z.array(shortText(40).min(1)).max(20),
  notes: shortText(10000),
  cards: entriesSchema,
});
export const matchSchema = z
  .object({
    id: uuid,
    deck_version_id: uuid,
    opponent_leader_id: uuid,
    result: z.enum(["win", "loss"]),
    went_first: z
      .enum(["true", "false"])
      .transform((value) => value === "true"),
    played_at: z.iso.datetime({ offset: true }),
    format: shortText(60).min(1),
    match_type: z.enum(["practice", "friendly", "ranked", "tournament"]),
    opponent_name: shortText(200),
    tournament_id: z.union([uuid, z.literal("")]),
    round_number: z.preprocess(
      (value) => (value === "" ? null : Number(value)),
      z.number().int().min(1).max(999).nullable(),
    ),
    notes: shortText(10000),
  })
  .refine(
    (value) => Boolean(value.tournament_id) === (value.round_number !== null),
    "Un torneo necesita número de ronda; una partida libre no lleva ronda.",
  );
export const tournamentSchema = z.object({
  id: uuid,
  name: shortText(200).min(1),
  event_date: z.iso.date(),
  location: shortText(300),
  format: shortText(60).min(1),
  deck_version_id: uuid,
  placement: z.preprocess(
    (value) => (value === "" ? null : Number(value)),
    z.number().int().min(1).max(100000).nullable(),
  ),
  notes: shortText(10000),
});
export function validationMessage(error: z.ZodError) {
  const labels: Record<string, string> = {
    id: "Registro",
    name: "Nombre",
    leader_card_id: "Líder",
    description: "Descripción",
    format: "Formato",
    status: "Estado",
    tags: "Etiquetas",
    notes: "Notas",
    cards: "Cartas y cantidades",
    card_number: "Código de carta",
    card_type: "Tipo de carta",
    colors: "Colores",
    cost: "Coste",
    power: "Poder",
    counter: "Counter",
    life: "Vida",
    printing_code: "Variante",
    canonical_card_id: "Identidad original",
    deck_version_id: "Versión del mazo",
    opponent_leader_id: "Líder rival",
    result: "Resultado",
    went_first: "Salida",
    played_at: "Fecha y hora",
    opponent_name: "Nombre rival",
    round_number: "Número de ronda",
    tournament_id: "Torneo",
    event_date: "Fecha del torneo",
    placement: "Posición final",
  };
  return `Revisa el formulario: ${[...new Set(error.issues.map((issue) => (issue.code === "custom" ? issue.message : `${labels[String(issue.path[0])] ?? "Dato"}: valor vacío, fuera de rango o no válido.`)))].slice(0, 5).join(" · ")}`;
}

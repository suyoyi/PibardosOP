import { z } from "zod";
import { cardNumberPattern, normalizeCardNumber } from "./cards";
import type { CardCandidate } from "./card-variants";
export const cardReferenceSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("saved"), id: z.uuid() }).strict(),
    z
      .object({
        kind: z.literal("remote"),
        external_id: z
          .string()
          .regex(/^optcg_(sets|decks|promos|don)_[A-Za-z0-9_-]{1,200}$/),
        family: z.enum(["sets", "decks", "promos", "don"]),
        card_number: z
          .string()
          .max(30)
          .transform(normalizeCardNumber)
          .refine((n) => cardNumberPattern.test(n)),
      })
      .strict(),
  ])
  .refine(
    (r) => r.kind === "saved" || r.external_id.startsWith(`optcg_${r.family}_`),
  );
export type CardReference = z.infer<typeof cardReferenceSchema>;
export function referenceForCandidate(candidate: CardCandidate): CardReference {
  return candidate.kind === "saved"
    ? { kind: "saved", id: candidate.card.id }
    : {
        kind: "remote",
        external_id: candidate.card.external_id,
        family: candidate.card.family,
        card_number: candidate.card.card_number,
      };
}

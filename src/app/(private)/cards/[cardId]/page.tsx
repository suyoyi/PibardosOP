import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { ManualCatalogProvider } from "@/lib/data";
import { uuid } from "@/domain/forms";
import { typeLabels, colorLabels } from "@/domain/cards";
import { CardArtwork } from "@/components/card-catalog";
import { PageHeading } from "@/components/ui";
export default async function CardPage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = await params;
  if (!uuid.safeParse(cardId).success) notFound();
  const { supabase } = await requireUser(),
    card = await new ManualCatalogProvider(supabase).getCard(cardId);
  if (!card) notFound();
  return (
    <>
      <PageHeading
        eyebrow={card.card_number}
        title={card.name}
        description={`${typeLabels[card.card_type]} · ${card.source === "manual" ? "Datos manuales sin verificar" : card.source}`}
      />
      <div className="panel grid gap-6 p-6 sm:grid-cols-2">
        <CardArtwork card={card} />
        <dl className="grid gap-4">
          {[
            ["Colores", card.colors.map((c) => colorLabels[c]).join(" / ")],
            ["Coste", card.cost],
            ["Poder", card.power],
            ["Counter", card.counter],
            ["Vida", card.life],
            ["Atributo", card.attribute],
            ["Colección", card.set_code],
            ["Variante", card.printing_code],
            ["Idioma", card.language],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="mt-1">{value ?? "No aplica / sin dato"}</dd>
            </div>
          ))}
        </dl>
        {card.effect_text && (
          <p className="whitespace-pre-wrap text-sm leading-6 sm:col-span-2">
            {card.effect_text}
          </p>
        )}
      </div>
    </>
  );
}

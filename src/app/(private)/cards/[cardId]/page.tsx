import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { ManualCatalogProvider } from "@/lib/data";
import { uuid } from "@/domain/forms";
import { typeLabels, colorLabels } from "@/domain/cards";
import { CardArtwork } from "@/components/card-catalog";
import { PageHeading } from "@/components/ui";
import { OptcgPrices } from "@/components/optcg-prices";
import { CardPrices } from "@/components/card-prices";
import { SavedNotice } from "@/components/forms";
import { CardPriceHistory } from "@/components/card-price-history";
import { historySelection } from "@/domain/price-history";
export default async function CardPage({
  params,
  searchParams,
}: {
  params: Promise<{ cardId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { cardId } = await params;
  if (!uuid.safeParse(cardId).success) notFound();
  const { supabase } = await requireUser(),
    card = await new ManualCatalogProvider(supabase).getCard(cardId);
  if (!card) notFound();
  const { data: provider, error: providerError } = await supabase
    .from("card_provider_items")
    .select("*")
    .eq("card_id", card.id)
    .maybeSingle();
  const { data: optcg, error: optcgError } = await supabase
    .from("optcg_card_items")
    .select("*")
    .eq("card_id", card.id)
    .maybeSingle();
  return (
    <>
      <PageHeading
        eyebrow={card.card_number}
        title={card.name}
        description={`${typeLabels[card.card_type]} · ${card.source === "manual" ? "Datos manuales sin verificar" : card.source}`}
      />
      <SavedNotice saved={(await searchParams).saved} />
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
      {(providerError || optcgError) && (
        <p role="alert" className="mt-6 text-sm text-red-200">
          No se pudieron leer los precios guardados. Revisa la conexión y las
          migraciones.
        </p>
      )}
      {optcg && (
        <OptcgPrices
          prices={optcg.prices}
          fetchedAt={optcg.fetched_at}
          sourceDate={optcg.source_date}
          externalId={optcg.external_id}
        />
      )}
      {optcg && (
        <div className="mt-6">
          <CardPriceHistory
            key={optcg.external_id}
            selection={historySelection(card.card_number, optcg.external_id)}
          />
        </div>
      )}
      {provider && (
        <CardPrices
          prices={provider.prices}
          fetchedAt={provider.fetched_at}
          externalId={provider.external_id}
          language={card.language}
        />
      )}
    </>
  );
}

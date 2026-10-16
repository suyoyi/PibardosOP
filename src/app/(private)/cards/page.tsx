import { collectionEnabled } from "@/lib/features";
import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { PageHeading } from "@/components/ui";
import { CardExplorer } from "@/components/card-explorer";
import { SavedNotice } from "@/components/forms";
import { getFanCatalog } from "@/lib/data";
import type { FanCard } from "@/domain/fan-cards";
export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { supabase } = await requireUser();
  let fanCards: FanCard[] = [],
    fanError: string | undefined;
  try {
    fanCards = await getFanCatalog(supabase);
  } catch {
    fanError =
      "No se pudo cargar la edición personalizada. Comprueba la conexión y vuelve a intentarlo.";
  }
  return (
    <>
      <PageHeading
        eyebrow="CONOCE TUS OPCIONES"
        title="Cartas"
        description="Explora el catálogo, descubre sus variantes y consulta habilidades y precios. No necesitas importar las cartas para verlas."
      />
      <SavedNotice saved={(await searchParams).saved} />
      {collectionEnabled && (
        <div className="mb-6 flex flex-wrap gap-3">
          <Link href="/collection" className="button-secondary">
            Mi colección
          </Link>
          <Link href="/wishlist" className="button-secondary">
            Lista de deseos
          </Link>
        </div>
      )}
      <CardExplorer fanCards={fanCards} fanError={fanError} />
    </>
  );
}

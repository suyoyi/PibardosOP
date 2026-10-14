import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { ManualCatalogProvider } from "@/lib/data";
import { PageHeading, EmptyState } from "@/components/ui";
import { CardCatalog } from "@/components/card-catalog";
import { SavedNotice } from "@/components/forms";
import { BerryWalletTools } from "@/components/berrywallet-tools";
import { berryConfigured } from "@/lib/berrywallet";
export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { supabase } = await requireUser(),
    catalog = await new ManualCatalogProvider(supabase).search({});
  return (
    <>
      <PageHeading
        eyebrow="CONOCE TUS OPCIONES"
        title="Cartas"
        description="Catálogo privado con cartas manuales o de BerryWallet. Ninguna fuente certifica aquí la legalidad actual de torneo."
      />
      <SavedNotice saved={(await searchParams).saved} />
      <div className="mb-6">
        <Link href="/cards/new" className="button-primary">
          Añadir carta manual
        </Link>
      </div>
      <BerryWalletTools enabled={berryConfigured()} />
      {catalog.length ? (
        <CardCatalog catalog={catalog} />
      ) : (
        <EmptyState title="El catálogo está vacío">
          <p>
            Añade tu líder y las cartas de tu lista para importarla. Las
            entradas desconocidas nunca se descartan al importar.
          </p>
        </EmptyState>
      )}
    </>
  );
}

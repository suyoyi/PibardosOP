import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { ManualCatalogProvider } from "@/lib/data";
import { PageHeading, EmptyState } from "@/components/ui";
import { CardCatalog } from "@/components/card-catalog";
import { SavedNotice } from "@/components/forms";
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
        description="Catálogo manual privado. Los datos que introduzcas no se presentan como información oficial verificada."
      />
      <SavedNotice saved={(await searchParams).saved} />
      <div className="mb-6">
        <Link href="/cards/new" className="button-primary">
          Añadir carta manual
        </Link>
      </div>
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

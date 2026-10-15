import { collectionEnabled } from "@/lib/features";
import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { PageHeading } from "@/components/ui";
import { CardExplorer } from "@/components/card-explorer";
import { SavedNotice } from "@/components/forms";
import { OptcgTools } from "@/components/optcg-tools";
export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireUser();
  return (
    <>
      <PageHeading
        eyebrow="CONOCE TUS OPCIONES"
        title="Cartas"
        description="Explora el catálogo inglés, descubre sus variantes y consulta habilidades y precios. No necesitas importar las cartas para verlas."
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
      <CardExplorer />
      <details className="mt-8">
        <summary className="min-h-12 cursor-pointer py-3 text-sm text-muted">
          Importación avanzada
        </summary>
        <OptcgTools />
      </details>
    </>
  );
}

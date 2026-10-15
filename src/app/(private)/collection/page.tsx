import { collectionEnabled } from "@/lib/features";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { getCollectionWorkspace } from "@/lib/collection";
import { PageHeading } from "@/components/ui";
import { CollectionWorkspaceView } from "@/components/collection-workspace";
export default async function CollectionPage({
  searchParams,
}: {
  searchParams: Promise<{ deck?: string }>;
}) {
  const { supabase } = await requireUser();
  if (!collectionEnabled) redirect("/cards");
  const w = await getCollectionWorkspace(supabase),
    q = await searchParams;
  if (q.deck && !w.decks.some((d) => d.id === q.deck)) notFound();
  const selected = q.deck ?? w.decks[0]?.id;
  return (
    <>
      <PageHeading
        eyebrow="TUS CARTAS REALES"
        title="Mi colección"
        description="Registra tus copias, reserva mazos físicos y descubre qué te falta. Los mazos virtuales no añaden cartas a la colección."
      />
      <CollectionWorkspaceView workspace={w} deckId={selected} />
    </>
  );
}

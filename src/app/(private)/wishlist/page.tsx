import { requireUser } from "@/lib/supabase/server";
import { getCollectionWorkspace } from "@/lib/collection";
import { PageHeading } from "@/components/ui";
import { CollectionWorkspaceView } from "@/components/collection-workspace";
export default async function WishlistPage() {
  const { supabase } = await requireUser(),
    w = await getCollectionWorkspace(supabase);
  return (
    <>
      <PageHeading
        eyebrow="TU PRÓXIMA INCORPORACIÓN"
        title="Lista de deseos"
        description="Guarda cartas y artes concretos con una cantidad objetivo, prioridad y notas. Un deseo no implica una compra ni añade copias."
      />
      <CollectionWorkspaceView workspace={w} wishlist />
    </>
  );
}

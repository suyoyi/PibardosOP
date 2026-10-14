import { requireUser } from "@/lib/supabase/server";
import { getCatalog } from "@/lib/data";
import { PageHeading } from "@/components/ui";
import { ManualCardForm } from "@/components/manual-card-form";
export default async function NewCardPage() {
  const { supabase } = await requireUser();
  return (
    <>
      <PageHeading
        eyebrow="TU CATÁLOGO"
        title="Añadir carta manual"
        description="Introduce únicamente los datos que puedas comprobar en tu carta."
      />
      <ManualCardForm catalog={await getCatalog(supabase)} />
    </>
  );
}

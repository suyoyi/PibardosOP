import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/supabase/server";
import { getDeckWorkspace } from "@/lib/data";
import { PageHeading } from "@/components/ui";
import { DeckBuilder } from "@/components/deck-builder";
export default async function ImportDeckPage() {
  const { supabase } = await requireUser(),
    { catalog, restrictions } = await getDeckWorkspace(supabase);
  return (
    <>
      <PageHeading
        eyebrow="TRAE TU ESTRATEGIA"
        title="Importar mazo"
        description="Pega tu lista, revisa las cartas y las cantidades, y confirma antes de guardarla."
      />
      <DeckBuilder
        id={randomUUID()}
        catalog={catalog}
        restrictions={restrictions}
        mode="import"
      />
    </>
  );
}

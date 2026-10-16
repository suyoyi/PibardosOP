import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/supabase/server";
import { getDeckWorkspace } from "@/lib/data";
import { PageHeading } from "@/components/ui";
import { DeckBuilder } from "@/components/deck-builder";
export default async function NewDeckPage() {
  const { supabase } = await requireUser(),
    { catalog, restrictions } = await getDeckWorkspace(supabase);
  return (
    <>
      <PageHeading
        eyebrow="PREPARA TU ESTRATEGIA"
        title="Crear mazo"
        description="Primero elige tu líder, después sus cartas y al final ponle nombre. Puedes seguir completándolo después."
      />
      <DeckBuilder
        id={randomUUID()}
        catalog={catalog}
        restrictions={restrictions}
      />
    </>
  );
}

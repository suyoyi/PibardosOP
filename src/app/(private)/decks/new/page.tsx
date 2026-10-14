import { randomUUID } from "node:crypto";
import Link from "next/link";
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
        description="Primero elige tu líder, después sus cartas y al final ponle nombre. Puedes guardar una lista incompleta como borrador."
      />
      {!catalog.length && (
        <p className="mb-6 text-sm text-muted">
          Busca tu líder y tus cartas en el constructor. También puedes{" "}
          <Link className="text-accent underline" href="/cards/new">
            crear una carta manual
          </Link>{" "}
          si falta en el proveedor.
        </p>
      )}
      <DeckBuilder
        id={randomUUID()}
        catalog={catalog}
        restrictions={restrictions}
      />
    </>
  );
}

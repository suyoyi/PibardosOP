import { requireUser } from "@/lib/supabase/server";
import { PageHeading, EmptyState } from "@/components/ui";
export default async function DecksPage() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("decks")
    .select("id,name,status,description")
    .order("updated_at", { ascending: false });
  if (error) throw new Error("No se pudieron consultar los mazos.");
  return (
    <>
      <PageHeading
        eyebrow="PREPARA TU ESTRATEGIA"
        title="Mazos"
        description="Tu biblioteca personal de listas."
      />
      {data.length ? (
        <ul className="grid gap-4">
          {data.map((deck) => (
            <li key={deck.id} className="panel p-5">
              <h2 className="font-semibold">{deck.name}</h2>
              <p className="mt-2 text-sm text-muted">
                {deck.description || "Sin descripción"}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Una biblioteca por construir">
          <p>
            No tienes mazos todavía. La importación y creación de listas llega
            en la fase 2.
          </p>
        </EmptyState>
      )}
    </>
  );
}

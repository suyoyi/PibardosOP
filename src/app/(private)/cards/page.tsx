import { requireUser } from "@/lib/supabase/server";
import { PageHeading, EmptyState } from "@/components/ui";
export default async function CardsPage() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("cards")
    .select("id,card_number,name")
    .order("card_number")
    .limit(100);
  if (error) throw new Error("No se pudo consultar el catálogo.");
  return (
    <>
      <PageHeading
        eyebrow="CONOCE TUS OPCIONES"
        title="Cartas"
        description="El catálogo utiliza datos con procedencia verificada."
      />
      {data.length ? (
        <>
          <p className="mb-4 text-sm text-muted">
            Primeras {data.length} cartas del catálogo. Búsqueda y filtros en la
            fase 2.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.map((card) => (
              <li key={card.id} className="panel p-4">
                <span className="text-xs text-accent">{card.card_number}</span>
                <h2 className="mt-1 font-semibold">{card.name}</h2>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyState title="El catálogo está vacío">
          <p>
            No se han añadido cartas. En la fase 2 podrás introducir datos
            manualmente; cualquier proveedor externo requerirá verificar su
            licencia y condiciones.
          </p>
        </EmptyState>
      )}
    </>
  );
}

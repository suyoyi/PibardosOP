import { PageHeading, SectionLink, EmptyState } from "@/components/ui";
import { requireUser } from "@/lib/supabase/server";
import Link from "next/link";

export default async function Dashboard() {
  const { supabase } = await requireUser();
  const [decks, matches] = await Promise.all([
    supabase
      .from("decks")
      .select("id", { count: "exact", head: true })
      .neq("status", "archived"),
    supabase.from("matches").select("id", { count: "exact", head: true }),
  ]);
  if (decks.error || matches.error)
    throw new Error(
      "No se pudo cargar tu espacio. Comprueba la conexión y las migraciones.",
    );
  return (
    <>
      <PageHeading
        eyebrow="TU CUADERNO DE JUEGO"
        title="Rumbo a la próxima partida"
        description="Tus listas y tus resultados, en un mismo espacio. Cada dato parte de lo que tú guardas."
      />
      <section aria-label="Resumen" className="mb-8 grid grid-cols-2 gap-4">
        <div className="panel p-5">
          <p className="text-sm text-muted">Mazos activos</p>
          <p className="mt-3 text-4xl font-semibold">{decks.count ?? 0}</p>
        </div>
        <div className="panel p-5">
          <p className="text-sm text-muted">Partidas registradas</p>
          <p className="mt-3 text-4xl font-semibold">{matches.count ?? 0}</p>
        </div>
      </section>
      <div className="mb-6 flex flex-wrap gap-3">
        <Link href="/matches/new" className="button-primary">
          Registrar partida
        </Link>
        <Link href="/decks/new" className="button-secondary">
          Importar mazo
        </Link>
        <Link href="/tournaments" className="button-secondary">
          Torneos
        </Link>
      </div>
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <SectionLink
          href="/decks"
          title="Tus mazos"
          description="Consulta el espacio de tus listas."
        />
        <SectionLink
          href="/statistics"
          title="Tu progreso"
          description="Resultados con su número real de partidas."
        />
      </div>
      {(matches.count ?? 0) === 0 ? (
        <EmptyState title="Tu historia empieza aquí">
          <p>
            Todavía no hay partidas registradas. Guarda un mazo y registra tu
            primera partida para empezar a ver tu evolución.
          </p>
        </EmptyState>
      ) : (
        <SectionLink
          href="/matches"
          title="Historial de partidas"
          description="Consulta los resultados que has guardado."
        />
      )}
    </>
  );
}

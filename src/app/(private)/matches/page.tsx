import { requireUser } from "@/lib/supabase/server";
import { PageHeading, EmptyState } from "@/components/ui";
export default async function MatchesPage() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("matches")
    .select("id,result,played_at")
    .order("played_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("No se pudieron cargar las partidas.");
  const labels: Record<string, string> = {
    win: "Victoria",
    loss: "Derrota",
    draw: "Empate",
  };
  return (
    <>
      <PageHeading
        eyebrow="CADA PARTIDA CUENTA"
        title="Partidas"
        description="Cada resultado estará asociado a la versión exacta del mazo utilizado."
      />
      {data.length ? (
        <>
          <p className="mb-4 text-sm text-muted">
            Últimas {data.length} partidas.
          </p>
          <ul className="grid gap-3">
            {data.map((match) => (
              <li key={match.id} className="panel flex justify-between p-4">
                <span>{labels[match.result]}</span>
                <time dateTime={match.played_at} className="text-sm text-muted">
                  {new Intl.DateTimeFormat("es-ES", {
                    dateStyle: "medium",
                    timeZone: "Europe/Madrid",
                  }).format(new Date(match.played_at))}
                </time>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyState title="Todavía no hay resultados">
          <p>
            El registro rápido de partidas y los torneos llegan en la fase 4.
          </p>
        </EmptyState>
      )}
    </>
  );
}

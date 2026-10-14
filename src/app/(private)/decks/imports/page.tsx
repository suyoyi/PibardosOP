import { requireUser } from "@/lib/supabase/server";
import { readAll } from "@/lib/data";
import { PageHeading } from "@/components/ui";
export default async function ImportsPage() {
  const { supabase } = await requireUser(),
    jobs = await readAll((a, b) =>
      supabase
        .from("import_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id")
        .range(a, b),
    );
  return (
    <>
      <PageHeading
        eyebrow="LISTAS REVISADAS"
        title="Historial de importaciones"
        description="Conservamos el texto original y los avisos de tus revisiones."
      />
      <ul className="grid gap-4">
        {jobs.map((job) => (
          <li className="panel p-5" key={job.id}>
            <h2 className="font-semibold">
              {job.status === "confirmed"
                ? "Guardada y confirmada"
                : "Vista previa sin guardar"}
            </h2>
            <p className="mt-2 text-xs text-muted">
              {new Date(job.created_at).toLocaleString("es-ES", {
                timeZone: "Europe/Madrid",
              })}
            </p>
            <details className="mt-3 text-sm">
              <summary className="min-h-12 cursor-pointer py-3">
                Ver texto y avisos
              </summary>
              <pre className="whitespace-pre-wrap break-words text-muted">
                {job.raw_input}
              </pre>
              <pre className="mt-4 whitespace-pre-wrap break-words text-xs">
                {JSON.stringify(job.error_report, null, 2)}
              </pre>
            </details>
          </li>
        ))}
      </ul>
      {!jobs.length && (
        <p className="panel p-5 text-muted">
          Todavía no has revisado ninguna importación.
        </p>
      )}
    </>
  );
}

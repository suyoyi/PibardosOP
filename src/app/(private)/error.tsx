"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section role="alert" className="panel max-w-xl p-7">
      <h1 className="text-2xl font-semibold">
        No hemos podido cargar tu espacio
      </h1>
      <p className="my-5 text-sm leading-6 text-muted">
        Comprueba tu conexión. Si el problema continúa, revisa la configuración
        de Supabase y que las migraciones estén aplicadas.
      </p>
      <button className="button-primary" onClick={reset}>
        Volver a intentar
      </button>
    </section>
  );
}

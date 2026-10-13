import { Compass, ShieldCheck, Layers3 } from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import { getSupabaseConfig } from "@/lib/config";
import { safeReturnPath } from "@/domain/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const configured = Boolean(getSupabaseConfig());
  return (
    <main
      id="main-content"
      className="mx-auto grid min-h-dvh max-w-6xl items-center gap-12 px-6 py-12 lg:grid-cols-2 lg:gap-24"
    >
      <section>
        <div className="mb-14 flex items-center gap-3">
          <span className="brand-mark">
            <Compass size={24} aria-hidden="true" />
          </span>
          <span className="font-bold tracking-wide">
            PIBARDOS <span className="text-accent">OP</span>
          </span>
        </div>
        <p className="eyebrow mb-4">TU ESPACIO DE JUEGO</p>
        <h1 className="max-w-lg text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
          Cada partida.
          <br />
          Un paso <span className="text-accent">más lejos.</span>
        </h1>
        <p className="mt-6 max-w-md text-base leading-7 text-muted">
          Un lugar para construir tus mazos, seguir tu progreso y preparar la
          próxima partida de One Piece Card Game.
        </p>
        <div className="mt-10 flex flex-wrap gap-5 text-sm text-muted">
          <span className="flex items-center gap-2">
            <ShieldCheck size={17} /> Espacio privado
          </span>
          <span className="flex items-center gap-2">
            <Layers3 size={17} /> Pensado para móvil
          </span>
        </div>
      </section>
      <section className="panel p-6 sm:p-9" aria-labelledby="access-title">
        <p className="eyebrow mb-3">BIENVENIDO A BORDO</p>
        <h2 id="access-title" className="mb-2 text-2xl font-semibold">
          Tu próxima sesión empieza aquí
        </h2>
        <p className="mb-8 text-sm leading-6 text-muted">
          Accede a tu cuenta para abrir tu espacio personal.
        </p>
        {configured ? (
          <AuthForm returnPath={safeReturnPath(params.next)} />
        ) : (
          <div
            role="status"
            className="rounded-xl border border-accent/30 bg-accent/5 p-5"
          >
            <h3 className="font-semibold">Conexión pendiente</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              Todavía falta configurar Supabase. Sigue las instrucciones de
              instalación del proyecto para activar el acceso seguro.
            </p>
          </div>
        )}
        <p className="mt-8 border-t border-border pt-5 text-xs leading-5 text-muted">
          Proyecto personal independiente. Sin afiliación oficial con Bandai,
          Shueisha ni los titulares de One Piece.
        </p>
      </section>
    </main>
  );
}

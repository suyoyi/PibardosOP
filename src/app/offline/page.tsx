import Link from "next/link";
export default function OfflinePage() {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-6"
    >
      <p className="eyebrow mb-4">PIBARDOS OP</p>
      <h1 className="text-3xl font-semibold">Estás sin conexión</h1>
      <p className="mt-5 mb-7 text-sm leading-6 text-muted">
        Tus datos privados requieren conexión. Cuando vuelvas a estar en línea,
        abre de nuevo tu espacio. Esta versión no guarda cambios sin conexión.
      </p>
      <Link href="/" className="button-primary">
        Volver a intentar
      </Link>
    </main>
  );
}

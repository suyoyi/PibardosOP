export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Cargando tu espacio"
      className="animate-pulse space-y-6"
    >
      <div className="h-9 w-3/4 rounded bg-white/10" />
      <div className="h-5 w-1/2 rounded bg-white/5" />
      <div className="grid grid-cols-2 gap-4">
        <div className="panel h-32" />
        <div className="panel h-32" />
      </div>
      <div className="panel h-64" />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

import Link from "next/link";
import { loadDeck } from "@/lib/deck-page";
import { PageHeading } from "@/components/ui";
export default async function VersionsPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params,
    w = await loadDeck(deckId);
  return (
    <>
      <PageHeading
        eyebrow="HISTORIAL INMUTABLE"
        title={`Versiones de ${w.deck.name}`}
        description="Cada versión conserva líder, formato y todas las cantidades. Las partidas siguen apuntando a la versión jugada."
      />
      <Link href={`/decks/${deckId}/compare`} className="button-secondary mb-6">
        Comparar versiones
      </Link>
      <ol className="grid gap-4">
        {[...w.deckVersions].reverse().map((version) => (
          <li key={version.id} className="panel grid gap-3 p-5">
            <h2 className="font-semibold">
              Versión {version.version_number}
              {version.id === w.deck.current_version_id ? " · actual" : ""}
            </h2>
            <p className="text-sm text-muted">
              {w.catalog.find((c) => c.id === version.leader_card_id)?.name} ·{" "}
              {version.format} ·{" "}
              {w.entries
                .filter(
                  (e) => e.deck_version_id === version.id && e.role === "main",
                )
                .reduce((n, e) => n + e.quantity, 0)}{" "}
              cartas
            </p>
            <time className="text-xs text-muted" dateTime={version.created_at}>
              {new Date(version.created_at).toLocaleString("es-ES", {
                timeZone: "Europe/Madrid",
              })}
            </time>
            <p className="whitespace-pre-wrap text-sm">
              {version.notes || "Sin nota de cambios"}
            </p>
            <Link
              href={`/decks/${deckId}/compare?after=${version.id}`}
              className="text-sm text-accent underline"
            >
              Ver esta versión y comparar
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}

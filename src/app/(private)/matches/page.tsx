import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { getCompetitiveWorkspace } from "@/lib/data";
import { PageHeading, EmptyState } from "@/components/ui";
import { SavedNotice } from "@/components/forms";
import { MatchHistory } from "@/components/match-history";
export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { supabase } = await requireUser(),
    w = await getCompetitiveWorkspace(supabase);
  return (
    <>
      <PageHeading
        eyebrow="CADA PARTIDA CUENTA"
        title="Partidas"
        description="Historial guardado con tu versión de mazo, líder rival, salida y resultado."
      />
      <SavedNotice saved={(await searchParams).saved} />
      <div className="mb-6 flex flex-wrap gap-3">
        <Link href="/matches/new" className="button-primary">
          Registrar partida
        </Link>
        <Link href="/tournaments" className="button-secondary">
          Torneos
        </Link>
        <Link href="/statistics" className="button-secondary">
          Ver gráficas
        </Link>
      </div>
      {w.matches.length ? (
        <MatchHistory
          matches={w.matches}
          decks={w.decks}
          versions={w.versions}
          catalog={w.catalog}
          tournaments={w.tournaments}
        />
      ) : (
        <EmptyState title="Todavía no hay resultados">
          <p>
            Registra tu primera partida: mazo y versión, líder rival, primero o
            segundo y victoria, derrota o empate.
          </p>
        </EmptyState>
      )}
    </>
  );
}

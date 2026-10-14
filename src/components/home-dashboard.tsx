"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  Plus,
  Swords,
  Trophy,
  Layers,
} from "lucide-react";
import type { DashboardData, DashboardLeader } from "@/domain/dashboard";
import { colorLabels } from "@/domain/cards";
import { CardArtwork } from "./card-catalog";
import { ResultsChart, DeckCostChart } from "./charts";
import { EmptyState } from "./ui";

const percent = (value: number | null) =>
  value === null
    ? "—"
    : `${(value * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 })}%`;
const resultLabels = { win: "Victoria", loss: "Derrota", draw: "Revisar" };
const dateFormat = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function ResultSummary({
  summary,
  label,
}: {
  summary: DashboardData["overall"];
  label: string;
}) {
  return (
    <section className="panel min-w-0 p-5 sm:p-6" aria-label={label}>
      <p className="eyebrow">TU REGISTRO</p>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{label}</h3>
          <p className="mt-1 text-xs text-muted">
            {summary.totalGames}{" "}
            {summary.totalGames === 1
              ? "partida guardada"
              : "partidas guardadas"}
          </p>
        </div>
        <Trophy size={22} className="shrink-0 text-accent" aria-hidden="true" />
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-3 text-center">
        {[
          ["Victorias", summary.wins, "text-[#91d9b0]"],
          ["Derrotas", summary.losses, "text-[#f4a5b1]"],
        ].map(([name, count, color]) => (
          <div key={name}>
            <dt className="text-xs text-muted">{name}</dt>
            <dd className={`mt-2 text-3xl font-semibold ${color}`}>{count}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex items-center justify-between gap-4 border-t border-border pt-5">
        <div>
          <p className="text-sm text-muted">Porcentaje de victorias</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-accent">
            {percent(summary.winRate)}
          </p>
        </div>
        <p className="text-right text-xs leading-5 text-muted">
          n = {summary.decisiveGames}
          <br />
          victorias + derrotas
        </p>
      </div>
      {summary.draws > 0 && (
        <p className="mt-4 text-xs text-amber-100">
          {summary.draws} registros antiguos pendientes de revisar; no cuentan
          como victoria o derrota.
        </p>
      )}
      <p className="mt-4 text-xs leading-5 text-muted">
        El porcentaje se calcula con victorias y derrotas.
        {summary.totalGames === 0
          ? " Registra tu primera partida para empezar."
          : summary.decisiveGames < 5
            ? " Muestra pequeña: aún hay pocas partidas para sacar conclusiones."
            : " Consulta la evolución para dar contexto al resultado."}
      </p>
    </section>
  );
}

function RecentGames({ games }: { games: DashboardData["recent"] }) {
  return (
    <section className="panel min-w-0 p-5 sm:p-6" aria-label="Últimas partidas">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="font-semibold">Últimas partidas</h3>
        <Link href="/matches" className="home-text-link">
          Historial <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
      {games.length ? (
        <ul className="grid gap-4">
          {games.map((game) => (
            <li
              key={game.id}
              className="flex min-w-0 items-start gap-3 border-b border-border pb-4 last:border-0 last:pb-0"
            >
              <span className={`home-result home-result-${game.result}`}>
                {resultLabels[game.result]}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/matches/${game.id}/edit`}
                  className="block break-words text-sm font-semibold hover:text-accent"
                >
                  {game.deckName} · v{game.versionNumber ?? "—"}
                </Link>
                <p className="mt-1 break-words text-xs text-muted">
                  vs. {game.opponent}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {game.wentFirst ? "Primero" : "Segundo"} ·{" "}
                  <time dateTime={game.playedAt}>
                    {dateFormat.format(new Date(game.playedAt))}
                  </time>
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-6 text-muted">
          Todavía no hay partidas con este líder. Registra una victoria, derrota
          y aparecerá aquí.
        </p>
      )}
    </section>
  );
}

function LeaderPanel({ leader }: { leader: DashboardLeader }) {
  const [deckId, setDeckId] = useState(leader.decks[0]?.id ?? "");
  const deck =
    leader.decks.find((item) => item.id === deckId) ?? leader.decks[0];
  return (
    <div className="grid gap-6" aria-label={`Panel de ${leader.card.name}`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">LÍDER SELECCIONADO</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            {leader.card.name}
          </h2>
          <p className="mt-2 text-xs leading-5 text-muted">
            {leader.card.card_number} ·{" "}
            {leader.card.colors
              .map((color) => colorLabels[color])
              .join(" / ") || "Color sin dato"}{" "}
            · {leader.decks.length}{" "}
            {leader.decks.length === 1 ? "mazo" : "mazos"}
          </p>
        </div>
        {deck?.versionId && (
          <Link
            href={`/matches/new?version=${deck.versionId}`}
            className="button-primary gap-2"
          >
            <Swords size={17} aria-hidden="true" />
            Registrar partida
          </Link>
        )}
      </div>
      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <ResultSummary summary={leader.summary} label="Resultados del líder" />
        <section
          className="panel min-w-0 p-5 sm:p-6"
          aria-label="Curva del mazo seleccionado"
        >
          <label>
            <span className="field-label">Mazo para la curva</span>
            <select
              className="field"
              value={deck?.id ?? ""}
              onChange={(event) => setDeckId(event.target.value)}
            >
              {leader.decks.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name} · v{item.versionNumber ?? "—"}
                </option>
              ))}
            </select>
          </label>
          {deck && (
            <>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <p className="text-muted">
                  Versión actual v{deck.versionNumber ?? "—"} ·{" "}
                  <strong className="text-foreground">
                    {deck.mainCount}/50 cartas
                  </strong>{" "}
                  · DON!! {deck.donCount}/10
                </p>
                <Link
                  className="home-text-link"
                  href={`/decks/${deck.id}/edit`}
                >
                  Editar mazo <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              </div>
              <DeckCostChart key={deck.id} rows={deck.curve} />
            </>
          )}
        </section>
      </div>
      <p className="-mt-2 text-xs leading-5 text-muted">
        El registro reúne todas las versiones jugadas con este líder, también
        las archivadas. La curva muestra solo el mazo y la versión indicados; no
        incluye líder ni DON!!.
      </p>
      <section aria-label="Mazos del líder">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="font-semibold">Tus mazos con este líder</h3>
          <Link href="/decks" className="home-text-link">
            Ver todos <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {leader.decks.map((item) => (
            <li key={item.id}>
              <Link href={`/decks/${item.id}`} className="home-deck-card panel">
                <div className="min-w-0 flex-1">
                  <span className="eyebrow">
                    {item.status === "draft" ? "BORRADOR" : "ACTIVO"}
                  </span>
                  <h4 className="mt-3 break-words text-base font-semibold">
                    {item.name}
                  </h4>
                  <p className="mt-2 text-sm text-muted">
                    {item.mainCount}/50 · v{item.versionNumber ?? "—"}
                  </p>
                  <p className="mt-2 text-xs text-muted">{item.format}</p>
                </div>
                <div className="home-deck-art">
                  <CardArtwork key={item.leader.id} card={item.leader} full />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <RecentGames games={leader.recent} />
        {leader.summary.totalGames ? (
          <ResultsChart
            title="Evolución mensual del líder (Madrid)"
            rows={leader.byMonth}
          />
        ) : (
          <section
            className="panel p-6"
            aria-label="Evolución mensual del líder (Madrid)"
          >
            <h3 className="font-semibold">Evolución mensual</h3>
            <p className="mt-3 text-sm leading-6 text-muted">
              Aquí verás victorias y derrotas por mes cuando registres partidas
              con este líder.
            </p>
            <Link href="/matches/new" className="home-text-link mt-4">
              Registrar mi primera partida{" "}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </section>
        )}
      </div>
      {leader.summary.totalGames > 0 && (
        <ResultsChart
          title="Resultados por orden de salida"
          rows={leader.byOrder}
        />
      )}
    </div>
  );
}

export function HomeDashboard({ data }: { data: DashboardData }) {
  const [leaderId, setLeaderId] = useState(data.leaders[0]?.id ?? "");
  const selected =
    data.leaders.find((leader) => leader.id === leaderId) ?? data.leaders[0];
  return (
    <div className="grid min-w-0 gap-7">
      <header className="home-hero panel">
        <div className="relative z-1">
          <p className="eyebrow">TU CUADERNO DE JUEGO</p>
          <h1 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Rumbo a la próxima partida
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
            Elige tu líder. Revisa tu estrategia. Sigue tu evolución.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/decks/new" className="button-primary gap-2">
              <Plus size={18} aria-hidden="true" />
              Crear mazo
            </Link>
            <Link href="/tournaments" className="button-secondary gap-2">
              <Trophy size={17} aria-hidden="true" />
              Torneos
            </Link>
          </div>
        </div>
        <Layers
          className="home-hero-icon"
          size={150}
          strokeWidth={1}
          aria-hidden="true"
        />
      </header>
      <section aria-label="Resumen general" className="home-overview panel">
        <div>
          <p className="text-xs text-muted">Mazos activos</p>
          <p className="mt-1 text-xl font-semibold">{data.activeDeckCount}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Partidas registradas</p>
          <p className="mt-1 text-xl font-semibold">
            {data.overall.totalGames}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Registro global V / D</p>
          <p className="mt-1 text-xl font-semibold">
            {data.overall.wins} / {data.overall.losses}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Victorias globales</p>
          <p className="mt-1 text-xl font-semibold text-accent">
            {percent(data.overall.winRate)}{" "}
            <span className="text-xs font-normal text-muted">
              n={data.overall.decisiveGames}
            </span>
          </p>
        </div>
      </section>
      {data.leaders.length ? (
        <div className="home-command-center">
          <section aria-label="Seleccionar líder" className="min-w-0">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Tus líderes</h2>
                <p className="mt-1 text-xs text-muted">
                  De tus mazos sin archivar · las variantes se agrupan
                </p>
              </div>
              <Link href="/decks" className="home-text-link">
                Mazos <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="home-leader-strip">
              {data.leaders.map((leader) => (
                <button
                  type="button"
                  key={leader.id}
                  aria-label={`Ver líder ${leader.card.card_number} · ${leader.card.name}`}
                  aria-pressed={selected?.id === leader.id}
                  onClick={() => setLeaderId(leader.id)}
                  className={`home-leader-option ${selected?.id === leader.id ? "home-leader-selected" : ""}`}
                >
                  <div className="home-leader-art">
                    <CardArtwork card={leader.card} full />
                    {selected?.id === leader.id && (
                      <span className="home-leader-check">
                        <Check size={15} aria-hidden="true" />
                      </span>
                    )}
                  </div>
                  <span className="mt-3 block truncate text-sm font-semibold">
                    {leader.card.name}
                  </span>
                  <span className="mt-1 block text-[10px] text-muted">
                    {leader.card.card_number} · {leader.decks.length}{" "}
                    {leader.decks.length === 1 ? "mazo" : "mazos"}
                  </span>
                </button>
              ))}
            </div>
          </section>
          {selected && <LeaderPanel key={selected.id} leader={selected} />}
        </div>
      ) : (
        <>
          <EmptyState title="Tu estrategia empieza con un líder">
            <p>
              Guarda tu primer mazo para ver aquí su líder, sus resultados y su
              curva de coste. Si tus mazos están archivados, puedes restaurarlos
              desde Mazos.
            </p>
            <Link href="/decks/new" className="button-primary mt-5">
              Crear mi primer mazo
            </Link>
          </EmptyState>
          {data.overall.totalGames > 0 && <RecentGames games={data.recent} />}
        </>
      )}
      <Link href="/statistics" className="home-text-link justify-self-start">
        Explorar todas las estadísticas{" "}
        <ArrowUpRight size={17} aria-hidden="true" />
      </Link>
    </div>
  );
}

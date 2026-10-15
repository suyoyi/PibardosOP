"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ChevronDown, Check } from "lucide-react";
import { getMatchLeaderChoices } from "@/app/(private)/matches/leader-actions";
import { getOptcgBuilderCard } from "@/app/(private)/cards/optcg-actions";
import { matchLeaderChoices, searchMatchLeaders } from "@/domain/match-leaders";
import { candidateKey } from "@/domain/card-variants";
import type { Card } from "@/domain/cards";
import { CardArtwork } from "./card-catalog";
import { CandidateArtwork } from "./builder-card-tile";
import { Modal } from "./modal";
import { Field } from "./forms";

export function OpponentLeaderPicker({
  catalog,
  initialId,
}: {
  catalog: Card[];
  initialId?: string;
}) {
  const [selected, setSelected] = useState(
    catalog.find((c) => c.id === initialId),
  );
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [limit, setLimit] = useState(24);
  const [choices, setChoices] = useState(() => matchLeaderChoices(catalog, []));
  const [loaded, setLoaded] = useState(false),
    [retry, setRetry] = useState(0),
    [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const [adding, startAdd] = useTransition();
  useEffect(() => {
    if (!open || loaded) return;
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await getMatchLeaderChoices();
        if (!active) return;
        if ("error" in result)
          setNotice(
            result.error ?? "No se pudo actualizar la lista de líderes.",
          );
        else {
          setChoices(result.choices);
          setNotice(
            result.issues.length
              ? "Algunos datos del proveedor no están disponibles. Se muestran los líderes utilizables y los guardados."
              : "",
          );
          setLoaded(true);
        }
      } catch {
        if (active)
          setNotice(
            "No se pudo actualizar la lista. Los líderes guardados siguen disponibles.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, loaded, retry]);
  const filtered = searchMatchLeaders(choices, query);
  return (
    <div className="grid gap-3">
      <input
        type="hidden"
        name="opponent_leader_id"
        value={selected?.id ?? ""}
      />
      <Field label="Líder rival">
        <button
          type="button"
          className="field flex items-center gap-3 text-left"
          aria-label="Elegir líder rival"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => {
            setOpen(true);
            setQuery("");
            setLimit(24);
            setError("");
          }}
        >
          {selected && <CardArtwork key={selected.id} card={selected} small />}
          <span className="min-w-0 flex-1 break-words">
            {selected ? (
              <>
                <strong className="block">{selected.name}</strong>
                <span className="mt-1 block text-xs text-muted">
                  {selected.card_number}
                </span>
              </>
            ) : (
              "Buscar y elegir líder rival"
            )}
          </span>
          <ChevronDown size={18} aria-hidden="true" className="shrink-0" />
        </button>
      </Field>
      {open && (
        <Modal
          title="Elegir líder rival"
          onClose={() => setOpen(false)}
          busy={adding}
        >
          <div className="grid gap-4">
            <Field label="Buscar líder rival">
              <input
                className="field"
                maxLength={120}
                placeholder="Nombre o número · Luffy, OP01-001…"
                value={query}
                disabled={adding}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.preventDefault();
                }}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setLimit(24);
                }}
              />
            </Field>
            <p role="status" className="text-xs text-muted">
              {adding
                ? "Seleccionando líder…"
                : loading
                  ? "Cargando líderes del catálogo…"
                  : `${filtered.length} líderes · una opción por código`}
            </p>
            {notice && (
              <div className="grid gap-2">
                <p className="text-sm text-amber-100">{notice}</p>
                {
                  <button
                    type="button"
                    className="button-secondary justify-self-start"
                    disabled={loading || adding}
                    onClick={() => {
                      setLoaded(false);
                      setRetry(retry + 1);
                    }}
                  >
                    Reintentar líderes
                  </button>
                }
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-200">
                {error}
              </p>
            )}
            <ul
              className="grid gap-2 sm:grid-cols-2"
              aria-label="Líderes rivales disponibles"
            >
              {filtered.slice(0, limit).map((candidate) => {
                const isSelected =
                  selected &&
                  (candidate.kind === "saved"
                    ? selected.id === candidate.card.id
                    : selected.source === "optcgapi" &&
                      selected.provider_card_id === candidate.card.external_id);
                return (
                  <li key={candidate.card.card_number} className="min-w-0">
                    <button
                      type="button"
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${isSelected ? "border-accent bg-accent/10" : "border-border"}`}
                      aria-label={`Elegir rival ${candidate.card.card_number} · ${candidate.card.name}`}
                      aria-pressed={Boolean(isSelected)}
                      disabled={adding}
                      onClick={() => {
                        setError("");
                        startAdd(async () => {
                          try {
                            let card: Card;
                            if (isSelected && selected) card = selected;
                            else if (candidate.kind === "saved")
                              card = candidate.card;
                            else {
                              const result = await getOptcgBuilderCard({
                                external_id: candidate.card.external_id,
                                card_number: candidate.card.card_number,
                                family: candidate.card.family,
                              });
                              if (!result.card) {
                                setError(
                                  result.error ??
                                    "No se pudo seleccionar el líder. Vuelve a intentarlo.",
                                );
                                return;
                              }
                              card = result.card;
                            }
                            if (card.card_type !== "leader") {
                              setError("La carta seleccionada no es un líder.");
                              return;
                            }
                            setSelected(card);
                            setOpen(false);
                          } catch {
                            setError(
                              "No se pudo seleccionar el líder. Se conservan los datos de la partida.",
                            );
                          }
                        });
                      }}
                    >
                      <span className="block h-24 w-[68px] shrink-0">
                        <CandidateArtwork
                          key={candidateKey(candidate)}
                          candidate={candidate}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block break-words text-sm">
                          {candidate.card.name}
                        </strong>
                        <span className="mt-1 block text-xs text-muted">
                          {candidate.card.card_number}
                        </span>
                      </span>
                      {isSelected && (
                        <Check
                          size={18}
                          className="shrink-0 text-accent"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            {!filtered.length && !loading && (
              <p className="text-sm text-muted">
                No hay líderes con esa búsqueda. Prueba otro nombre o número, o
                añade una carta manual.
              </p>
            )}
            {limit < filtered.length && (
              <button
                type="button"
                className="button-secondary"
                disabled={adding}
                onClick={() => setLimit(limit + 24)}
              >
                Mostrar más líderes
              </button>
            )}
            <Link
              href="/cards/new"
              className={`text-sm text-accent underline ${adding ? "pointer-events-none" : ""}`}
              tabIndex={adding ? -1 : undefined}
              aria-disabled={adding || undefined}
            >
              Añadir líder manual
            </Link>
          </div>
        </Modal>
      )}
    </div>
  );
}

"use client";
import { Check, Minus, Plus } from "lucide-react";
import type { CardCandidate } from "@/domain/card-variants";
import { CardArtwork, CardPicture } from "./card-catalog";

export function CandidateArtwork({ candidate }: { candidate: CardCandidate }) {
  const card = candidate.card;
  return candidate.kind === "saved" ? (
    <CardArtwork card={candidate.card} full />
  ) : (
    <CardPicture
      src={
        card.image_url
          ? `/api/cards/preview?url=${encodeURIComponent(card.image_url)}`
          : null
      }
      name={card.name}
      number={card.card_number}
      full
    />
  );
}

export function BuilderCardTile({
  candidate,
  quantity,
  selected,
  busy,
  canAdd,
  onChoose,
}: {
  candidate: CardCandidate;
  quantity: number;
  selected: boolean;
  busy: boolean;
  canAdd: boolean;
  onChoose: (delta: number) => void;
}) {
  const card = candidate.card,
    isLeader = card.card_type === "leader",
    name = `${card.card_number} · ${card.name}`;
  const printing =
    candidate.kind === "saved"
      ? candidate.card.source === "custom-artwork"
        ? "Arte personalizado"
        : candidate.card.printing_code
      : candidate.card.variant;
  return (
    <li className="min-w-0">
      <div className={`picker-card ${selected ? "picker-card-selected" : ""}`}>
        <button
          type="button"
          className="absolute inset-0 h-full w-full"
          aria-label={
            isLeader ? `Elegir líder ${name}` : `Añadir tocando imagen ${name}`
          }
          aria-pressed={isLeader ? selected : undefined}
          disabled={busy || !canAdd}
          onClick={() => onChoose(1)}
        >
          <CandidateArtwork candidate={candidate} />
        </button>
        {isLeader ? (
          selected && (
            <span className="picker-quantity" aria-label="Líder seleccionado">
              <Check size={16} aria-hidden="true" />
            </span>
          )
        ) : (
          <>
            <span
              className="picker-quantity"
              aria-label={`Copias ${name}: ${quantity}`}
            >
              {quantity}
            </span>
            <div className="picker-quantity-controls">
              <button
                type="button"
                aria-label={`Quitar ${name}`}
                disabled={busy || quantity === 0}
                onClick={() => onChoose(-1)}
              >
                <Minus size={20} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={`Añadir ${name}`}
                disabled={busy || !canAdd}
                onClick={() => onChoose(1)}
              >
                <Plus size={20} aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </div>
      <div className="picker-caption">
        <span>{card.card_number}</span>
      </div>
      <p className="mt-2 break-words text-xs font-semibold">{card.name}</p>
      <p className="mt-1 break-words text-[10px] leading-4 text-muted">
        {card.set_code ?? "Expansión sin dato"} · {printing}
      </p>
      {isLeader && (
        <button
          type="button"
          className="button-secondary mt-2 w-full px-2"
          aria-label={`Seleccionar impresión ${printing}`}
          disabled={busy}
          onClick={() => onChoose(1)}
        >
          {selected ? "Líder seleccionado" : "Elegir esta variante"}
        </button>
      )}
    </li>
  );
}

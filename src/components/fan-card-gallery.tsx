"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  type FanCard,
  fanArtworkForCard,
  fanEdition,
  filterFanCards,
} from "@/domain/fan-cards";
import { CardPicture } from "./card-catalog";
import { Modal } from "./modal";

function FanArtwork({ card }: { card: FanCard }) {
  const artwork = fanArtworkForCard(card);
  return (
    <CardPicture
      src={artwork ? `/api/custom-artworks/${artwork.id}/image` : null}
      name={card.name}
      number={card.display_number ?? ""}
      full
    />
  );
}
export function FanCardGallery({
  cards,
  search,
  error,
  editionOnly,
  onRetry,
}: {
  cards: FanCard[];
  search: string;
  error?: string;
  editionOnly: boolean;
  onRetry?: () => void;
}) {
  const [selected, setSelected] = useState<FanCard | null>(null);
  const router = useRouter();
  const matches = filterFanCards(cards, search);
  if (!editionOnly && !matches.length && !error) return null;
  return (
    <section className="grid gap-4" aria-label={fanEdition.name}>
      <div>
        <p className="eyebrow">EDICIÓN PERSONALIZADA</p>
        <h2 className="mt-2 break-words font-semibold">{fanEdition.name}</h2>
        <p className="mt-2 text-sm text-muted">
          {matches.length} {matches.length === 1 ? "carta" : "cartas"}
        </p>
      </div>
      {error ? (
        <div className="panel grid gap-3 p-5">
          <p role="alert">{error}</p>
          <button
            className="button-secondary"
            onClick={() => (onRetry ? onRetry() : router.refresh())}
          >
            Reintentar edición
          </button>
        </div>
      ) : (
        <>
          <ul
            className="picker-grid"
            aria-label="Cartas de la edición personalizada"
          >
            {matches.map((card) => (
              <li key={card.id} className="min-w-0">
                <button
                  type="button"
                  className="block w-full text-left"
                  aria-label={`Ver carta fan ${card.name}`}
                  onClick={() => setSelected(card)}
                >
                  <div className="picker-card">
                    <FanArtwork card={card} />
                  </div>
                  <p className="mt-2 break-words text-xs font-semibold">
                    {card.name}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          {!matches.length && (
            <p className="panel p-5 text-sm text-muted">
              No hay cartas con esta búsqueda en la edición.
            </p>
          )}
        </>
      )}
      {selected && (
        <Modal title={selected.name} onClose={() => setSelected(null)}>
          <div className="leader-zoom-art">
            <FanArtwork card={selected} />
          </div>
        </Modal>
      )}
    </section>
  );
}

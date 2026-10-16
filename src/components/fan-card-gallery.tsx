"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { revealFanCard } from "@/app/(private)/cards/fan-actions";
import {
  type FanCard,
  type FanCardVariant,
  fanArtworkForCard,
  fanArtworkOptions,
  fanEdition,
  fanGalleryEntries,
} from "@/domain/fan-cards";
import { CardPicture } from "./card-catalog";
import { Modal } from "./modal";

function FanArtwork({
  card,
  artworkId = card.artwork_id,
}: {
  card: FanCard;
  artworkId?: string;
}) {
  const artwork = fanArtworkForCard({ id: card.id, artwork_id: artworkId });
  return (
    <CardPicture
      key={artworkId}
      src={artwork ? `/api/custom-artworks/${artwork.id}/image` : null}
      name={card.name}
      number={card.display_number ?? ""}
      full
    />
  );
}
function FanCardModal({
  card,
  variants,
  onClose,
}: {
  card: FanCard;
  variants: FanCardVariant[];
  onClose: () => void;
}) {
  const options = fanArtworkOptions(card, variants);
  const [selectedId, setSelectedId] = useState(card.artwork_id);
  const current = options.find((art) => art.id === selectedId) ?? options[0];
  return (
    <Modal title={card.name} onClose={onClose}>
      <div
        role="group"
        aria-label="Carta ampliada"
        className="leader-zoom-art"
        style={options.length > 1 ? { maxHeight: "52dvh" } : undefined}
      >
        <FanArtwork card={card} artworkId={current?.id} />
      </div>
      {options.length > 1 && (
        <div
          role="group"
          aria-label="Variantes de la carta"
          className="mt-4 flex flex-wrap justify-center gap-3"
        >
          {options.map((art) => (
            <button
              key={art.id}
              type="button"
              className={`min-w-28 max-w-40 rounded-xl border-2 p-2 ${current?.id === art.id ? "border-accent" : "border-border"}`}
              aria-label={`Ver variante ${art.label}`}
              aria-pressed={current?.id === art.id}
              onClick={() => setSelectedId(art.id)}
            >
              <span className="mx-auto block aspect-[5/7] w-14">
                <FanArtwork card={card} artworkId={art.id} />
              </span>
              <span className="mt-2 block text-xs">{art.label}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
export function FanCardGallery({
  cards,
  variants,
  revealedCardIds,
  onRevealed,
  search,
  error,
  onRetry,
}: {
  cards: FanCard[];
  variants: FanCardVariant[];
  revealedCardIds: string[];
  onRevealed: (cardId: string) => void;
  search: string;
  error?: string;
  onRetry?: () => void;
}) {
  const [selected, setSelected] = useState<FanCard | null>(null);
  const [revealing, setRevealing] = useState<string | null>(null);
  const [revealError, setRevealError] = useState("");
  const [notice, setNotice] = useState("");
  const cardsRef = useRef<HTMLUListElement>(null);
  const router = useRouter();
  const matches = fanGalleryEntries(cards, revealedCardIds, search);
  async function reveal(card: FanCard) {
    if (revealing) return;
    setRevealing(card.id);
    setRevealError("");
    setNotice("");
    try {
      const result = await revealFanCard(card.id);
      if ("error" in result) {
        setRevealError(result.error);
        return;
      }
      onRevealed(card.id);
      setNotice(
        `${card.name} revelada. El desbloqueo está guardado en tu cuenta.`,
      );
      setSelected(card);
    } catch {
      setRevealError(
        "No se pudo guardar el desbloqueo. Comprueba la conexión y vuelve a pulsar el botón.",
      );
    } finally {
      setRevealing(null);
    }
  }
  return (
    <section className="grid gap-4" aria-label={fanEdition.name}>
      <div>
        <p className="eyebrow">EDICIÓN PERSONALIZADA</p>
        <h2 className="mt-2 break-words font-semibold">{fanEdition.name}</h2>
        <p className="mt-2 text-sm text-muted">
          {matches.length} {matches.length === 1 ? "carta" : "cartas"}
        </p>
      </div>
      {revealError && (
        <p role="alert" className="panel p-4 text-sm text-red-200">
          {revealError}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-accent">
          {notice}
        </p>
      )}
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
            ref={cardsRef}
            className="picker-grid"
            aria-label="Cartas de la edición personalizada"
          >
            {matches.map(({ card, role, revealed }) => (
              <li key={card.id} className="min-w-0">
                {revealed ? (
                  <button
                    type="button"
                    className="block w-full text-left"
                    aria-label={`Ver carta fan ${card.name}`}
                    data-fan-card-id={card.id}
                    onClick={() => setSelected(card)}
                  >
                    <div className="picker-card">
                      <FanArtwork card={card} />
                    </div>
                    <p className="mt-2 break-words text-xs font-semibold">
                      {card.name}
                    </p>
                  </button>
                ) : (
                  <div>
                    <div
                      className="picker-card fan-card-locked"
                      aria-hidden="true"
                    >
                      <div className="fan-card-seal">
                        <LockKeyhole size={28} strokeWidth={1.5} />
                      </div>
                      <span className="mt-5 text-center text-[10px] tracking-[0.18em] text-accent/70">
                        POR DESCUBRIR
                      </span>
                    </div>
                    <button
                      type="button"
                      className="button-secondary mt-2 w-full px-2 text-center text-xs leading-5"
                      aria-label={role}
                      disabled={revealing !== null}
                      onClick={() => {
                        void reveal(card);
                      }}
                    >
                      {revealing === card.id ? "Revelando…" : role}
                    </button>
                  </div>
                )}
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
        <FanCardModal
          key={selected.id}
          card={selected}
          variants={variants}
          onClose={() => {
            const cardId = selected.id;
            setSelected(null);
            // A successful reveal replaced the original locked trigger button.
            requestAnimationFrame(() =>
              cardsRef.current
                ?.querySelector<HTMLButtonElement>(
                  `[data-fan-card-id="${cardId}"]`,
                )
                ?.focus({ preventScroll: true }),
            );
          }}
        />
      )}
    </section>
  );
}

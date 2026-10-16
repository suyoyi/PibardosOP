import type { Card } from "@/domain/cards";
import { CardArtwork } from "./card-catalog";

// Shared by catalog, saved card, deck detail and leader zoom. Fan cards have
// an image-only presentation even though their canonical game facts are retained.
export function CustomArtworkView({ card }: { card: Card }) {
  return (
    <div className="leader-zoom-art" aria-label={`Carta fan ${card.name}`}>
      <CardArtwork key={card.id} card={card} full />
    </div>
  );
}

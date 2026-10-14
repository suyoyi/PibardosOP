import { describe, expect, it } from "vitest";
import {
  compatibleWithLeader,
  builderCopyCount,
  builderMaximumQuantity,
} from "../../src/domain/deck-builder";
import { leader, main, alternate, don, syntheticCard } from "../fixtures/cards";
import { normalizeCardSearch, filterCards } from "../../src/domain/cards";
import { matchSchema } from "../../src/domain/forms";
import type { DeckEntry } from "../../src/domain/deck-import";
const catalog = [leader, main, alternate, don];
describe("guided construction constraints", () => {
  it("counts the four-copy budget across alternate artwork and canonical reprints", () => {
    const reprint = syntheticCard(9, {
      card_number: "ST00-001",
      canonical_card_id: main.id,
    });
    const entries: DeckEntry[] = [
      { card_id: main.id, quantity: 2, role: "main" },
      { card_id: alternate.id, quantity: 1, role: "main" },
      { card_id: reprint.id, quantity: 1, role: "main" },
    ];
    const all = [...catalog, reprint];
    expect(builderCopyCount(alternate, entries, all)).toBe(4);
    expect(builderMaximumQuantity(alternate, entries, all)).toBe(1);
    expect(
      builderMaximumQuantity(
        {
          card_number: main.card_number,
          card_type: "character",
          colors: ["red"],
        },
        entries,
        all,
      ),
    ).toBe(0);
  });
  it("allows either color of a dual leader and rejects incompatible/unknown colors", () => {
    const dual = { colors: ["red", "green"] as const };
    const selected = { colors: [...dual.colors] };
    expect(compatibleWithLeader(main, selected)).toBe(true);
    expect(
      compatibleWithLeader(syntheticCard(10, { colors: ["green"] }), selected),
    ).toBe(true);
    expect(
      compatibleWithLeader(syntheticCard(11, { colors: ["blue"] }), selected),
    ).toBe(false);
    expect(compatibleWithLeader(main, undefined)).toBe(false);
    expect(
      compatibleWithLeader(syntheticCard(12, { colors: [] }), selected),
    ).toBe(false);
  });
  it("keeps ten DON separate from the main-deck size and copy budget", () => {
    const cards = Array.from({ length: 13 }, (_, index) =>
      syntheticCard(index + 20),
    );
    const entries: DeckEntry[] = cards.map((card, index) => ({
      card_id: card.id,
      role: "main",
      quantity: index === 12 ? 2 : 4,
    }));
    const all = [...catalog, ...cards];
    expect(builderMaximumQuantity(main, entries, all)).toBe(0);
    expect(builderMaximumQuantity(don, entries, all)).toBe(10);
    expect(
      builderMaximumQuantity(
        don,
        [...entries, { card_id: don.id, role: "don", quantity: 10 }],
        all,
      ),
    ).toBe(10);
  });
  it("normalizes short printed codes and expansion aliases without rewriting card names", () => {
    expect(normalizeCardSearch("op17-99")).toBe("OP17-099");
    expect(normalizeCardSearch("  Monkey D. Luffy  ")).toBe("Monkey D. Luffy");
    const card = syntheticCard(99, {
      card_number: "OP17-099",
      set_code: "OP-17",
    });
    expect(
      filterCards([card], { search: "op17-99", set: "OP17", cost: "2" }),
    ).toEqual([card]);
  });
  it("accepts only win/loss outcomes at the server validation boundary", () => {
    const input = {
      id: leader.id,
      deck_version_id: main.id,
      opponent_leader_id: alternate.id,
      went_first: "true",
      played_at: "2026-10-14T12:00:00Z",
      format: "standard",
      match_type: "friendly",
      opponent_name: "",
      tournament_id: "",
      round_number: "",
      notes: "",
    };
    expect(matchSchema.safeParse({ ...input, result: "win" }).success).toBe(
      true,
    );
    expect(matchSchema.safeParse({ ...input, result: "loss" }).success).toBe(
      true,
    );
    expect(matchSchema.safeParse({ ...input, result: "draw" }).success).toBe(
      false,
    );
  });
});

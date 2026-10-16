import { compactDecklist, compactEntries } from "../fixtures/import-list";
import { describe, it, expect } from "vitest";
import {
  parseDecklist,
  importedMainEntries,
  exportDecklist,
  normalizeDeckText,
} from "../../src/domain/deck-import";
import {
  validateDeck,
  compareEntries,
  costCurve,
  standardRules,
} from "../../src/domain/decks";
import { leader, main, alternate, don, syntheticCard } from "../fixtures/cards";
describe("decklist normalization and preview", () => {
  it("parses the full compact 16-code list as one leader and 50 main cards, retaining every unknown without a catalog", () => {
    const catalog = compactEntries.map(({ code }, index) =>
      syntheticCard(300 + index, {
        card_number: code,
        card_type: index === 0 ? "leader" : "character",
      }),
    );
    const parsed = parseDecklist(compactDecklist, catalog);
    expect(parsed.unknown).toEqual([]);
    expect(parsed.malformed).toEqual([]);
    expect(parsed.entries.map((e) => e.quantity)).toEqual(
      compactEntries.map((e) => e.quantity),
    );
    expect(
      importedMainEntries(parsed).reduce((sum, e) => sum + e.quantity, 0),
    ).toBe(50);
    const unknown = parseDecklist(compactDecklist, []);
    expect(unknown.unknown).toHaveLength(16);
    expect(unknown.malformed).toEqual([]);
  });
  it("normalizes browser form CRLF and legacy CR to the same audited text", () => {
    expect(normalizeDeckText("1 OP00-001\r\n4 OP00-002\r")).toBe(
      "1 OP00-001\n4 OP00-002\n",
    );
    expect(
      parseDecklist("4 OP00-002\r2 OP00-002", [main]).entries[0].quantity,
    ).toBe(6);
  });
  it.each([
    "4 OP00-002",
    "4x OP00-002",
    "4×OP00-002",
    "OP00-002 x4",
    "OP00-002 × 4",
    "op00–002 4",
    "  4   OP00-002  ",
  ])("parses %s", (line) => {
    const r = parseDecklist(line, [main]);
    expect(r.entries[0].quantity).toBe(4);
    expect(r.unknown).toEqual([]);
    expect(r.malformed).toEqual([]);
  });
  it("preserves unknown and malformed lines and their positions", () => {
    const r = parseDecklist(
      "# comment\n4 OP99-999\n0 OP00-002\nOP00-XYZ\n2.5 OP00-002\n51 OP00-002",
      [main],
    );
    expect(r.unknown.map((e) => e.line)).toEqual([2]);
    expect(r.malformed.map((e) => e.line)).toEqual([3, 4, 5, 6]);
    expect(r.entries).toEqual([]);
  });
  it("aggregates duplicates with explicit preview and chooses canonical printing", () => {
    const r = parseDecklist("2 OP00-002\nOP00-002 x3", [alternate, main]);
    expect(r.entries[0].card.id).toBe(main.id);
    expect(r.entries[0].quantity).toBe(5);
    expect(r.duplicates).toEqual([
      { card_number: main.card_number, quantity: 5, lines: [1, 2] },
    ]);
  });
  it("separates the leader and DON from main cards, and round-trips export", () => {
    const catalog = [leader, main, don],
      r = parseDecklist("1 OP00-001\n4 OP00-002\n10 DON!!", catalog);
    const entries = importedMainEntries(r);
    expect(entries.map((e) => e.role)).toEqual(["main", "don"]);
    expect(
      importedMainEntries(
        parseDecklist(exportDecklist(leader, entries, catalog), catalog),
      ),
    ).toEqual(entries);
  });
  it("does not silently discard arbitrary headings or HTML", () => {
    expect(
      parseDecklist("<script>alert(1)</script>\nA custom heading", [main])
        .malformed,
    ).toHaveLength(2);
  });
  it("rejects oversized input", () => {
    expect(parseDecklist("a".repeat(100001), []).malformed[0].code).toBe(
      "INPUT_LIMIT",
    );
  });
});
describe("construction rules and immutable comparisons", () => {
  it("bridges manual/shared roots by printed code and reprints by canonical identity", () => {
    const separateRoot = syntheticCard(99, { card_number: main.card_number });
    const reprint = syntheticCard(98, {
      card_number: "ST00-002",
      canonical_card_id: main.id,
    });
    for (const other of [separateRoot, reprint])
      expect(
        validateDeck(
          leader,
          [
            { card_id: main.id, quantity: 3, role: "main" },
            { card_id: other.id, quantity: 2, role: "main" },
          ],
          [leader, main, other],
        ).issues.map((i) => i.code),
      ).toContain("COPY_LIMIT");
  });
  it("does not claim construction is verified when card colors are unknown", () => {
    const cards = Array.from({ length: 13 }, (_, i) =>
      syntheticCard(i + 10, { colors: [] }),
    );
    const r = validateDeck(
      leader,
      cards.map((c, i) => ({
        card_id: c.id,
        quantity: i === 12 ? 2 : 4,
        role: "main",
      })),
      [leader, ...cards],
    );
    expect(r.validConstruction).toBe(true);
    expect(r.constructionVerified).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain("COLOR_UNVERIFIED");
  });
  it("accepts exactly fifty correctly typed compatible main cards, but does not claim verified legality", () => {
    const cards = Array.from({ length: 13 }, (_, i) => syntheticCard(i + 10)),
      entries = cards.map((c, i) => ({
        card_id: c.id,
        quantity: i === 12 ? 2 : 4,
        role: "main" as const,
      }));
    const r = validateDeck(leader, entries, [leader, ...cards]);
    expect(r.mainCount).toBe(50);
    expect(r.validConstruction).toBe(true);
    expect(r.tournamentLegality).toBe("unverified");
  });
  it("counts all alternate printings against a canonical copy limit", () => {
    const r = validateDeck(
      leader,
      [
        { card_id: main.id, quantity: 3, role: "main" },
        { card_id: alternate.id, quantity: 2, role: "main" },
      ],
      [leader, main, alternate],
    );
    expect(r.issues.some((i) => i.code === "COPY_LIMIT")).toBe(true);
  });
  it("reports missing leader, incorrect count, incompatible color and main type", () => {
    const blue = syntheticCard(8, { colors: ["blue"] });
    const r = validateDeck(
      leader,
      [
        { card_id: blue.id, quantity: 4, role: "main" },
        { card_id: leader.id, quantity: 1, role: "main" },
      ],
      [leader, blue],
    );
    expect(r.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(["MAIN_COUNT", "COLOR", "MAIN_TYPE"]),
    );
    expect(validateDeck(undefined, [], []).issues.map((i) => i.code)).toContain(
      "LEADER",
    );
  });
  it("honors effective verified restrictions and ignores expired/future/other-format restrictions", () => {
    const restriction = {
      id: "r",
      canonical_card_id: main.id,
      format: "standard",
      restriction_type: "restricted" as const,
      maximum_quantity: 1,
      effective_from: "2026-01-01",
      effective_until: "2026-12-31",
      source_url: "https://example.invalid/synthetic",
      verified_at: "2026-01-01T00:00:00Z",
    };
    const entries = [{ card_id: main.id, quantity: 2, role: "main" as const }];
    expect(
      validateDeck(
        leader,
        entries,
        [leader, main],
        [restriction],
        standardRules("standard", "2026-04-01"),
      ).issues.map((i) => i.code),
    ).toContain("COPY_LIMIT");
    expect(
      validateDeck(
        leader,
        entries,
        [leader, main],
        [restriction],
        standardRules("standard", "2027-04-01"),
      ).issues.map((i) => i.code),
    ).not.toContain("COPY_LIMIT");
    expect(
      validateDeck(
        leader,
        entries,
        [leader, main],
        [restriction],
        standardRules("other", "2026-04-01"),
      ).issues.map((i) => i.code),
    ).not.toContain("COPY_LIMIT");
  });
  it("keeps DON outside main count and validates its separate size", () => {
    const r = validateDeck(
      leader,
      [{ card_id: don.id, quantity: 10, role: "don" }],
      [leader, don],
    );
    expect(r.mainCount).toBe(0);
    expect(r.donCount).toBe(10);
    expect(r.issues.map((i) => i.code)).not.toContain("COPY_LIMIT");
  });
  it("compares without mutating snapshots and labels missing cost", () => {
    const a = Object.freeze([
        { card_id: main.id, quantity: 4, role: "main" as const },
      ]),
      b = [
        { card_id: main.id, quantity: 3, role: "main" as const },
        { card_id: alternate.id, quantity: 1, role: "main" as const },
      ];
    expect(compareEntries(a, b).map((e) => [e.before, e.after])).toEqual([
      [4, 3],
      [0, 1],
    ]);
    expect(a[0].quantity).toBe(4);
    expect(
      costCurve(
        [{ card_id: main.id, quantity: 4, role: "main" }],
        [{ ...main, cost: null }],
      ),
    ).toEqual([{ cost: "Sin dato", quantity: 4 }]);
  });
});

it("exports only quantities/codes and combines alternate printings without comments", () => {
  const text = exportDecklist(
    leader,
    [
      { card_id: main.id, quantity: 2, role: "main" },
      { card_id: alternate.id, quantity: 2, role: "main" },
      { card_id: don.id, quantity: 10, role: "don" },
    ],
    [leader, main, alternate, don],
  );
  expect(text).toBe(
    `1 ${leader.card_number}\n4 ${main.card_number}\n10 ${don.card_number}`,
  );
  expect(text).not.toContain("#");
});

import { it, expect, vi } from "vitest";
import {
  normalizePriceHistory,
  historySelection,
} from "../../src/domain/price-history";
import { OptcgClient, type OptcgTransport } from "../../src/domain/optcg";
import { optcgHistoryRecord } from "../fixtures/optcg";
const selection = {
  card_number: "OP97-010",
  external_id: "optcg_sets_OP97-010",
  family: "sets" as const,
};

it("preserves the 13 documented fields and last quote without inventing their dates or chronology", () => {
  const result = normalizePriceHistory([optcgHistoryRecord()], selection);
  expect(result.status).toBe("available");
  expect(result.points).toHaveLength(14);
  expect(result.points[0]).toEqual({
    slot: "Day1",
    market: 1.1,
    inventory: 2.1,
  });
  expect(result.points[12]).toEqual({
    slot: "Day13",
    market: 2.3,
    inventory: 3.3,
  });
  expect(result.points[13]).toEqual({
    slot: "Última",
    market: 2.5,
    inventory: null,
  });
  expect(result.sourceDate).toBe("2026-01-02");
});
it("selects exact artwork even when the base printing is first", () => {
  const result = normalizePriceHistory(
    [
      optcgHistoryRecord(),
      optcgHistoryRecord({
        card_image_id: "OP97-010_p1",
        Day1_Market_Price: 0,
        market_price: 10,
      }),
    ],
    { ...selection, external_id: "optcg_sets_OP97-010_p1" },
  );
  expect(result.points[0].market).toBe(0);
  expect(result.points.at(-1)?.market).toBe(10);
});
it("does not substitute a base, another printed number or an ambiguous duplicate series", () => {
  expect(
    normalizePriceHistory([optcgHistoryRecord()], {
      ...selection,
      external_id: "optcg_sets_OP97-010_p2",
    }),
  ).toMatchObject({ status: "unavailable", points: [] });
  expect(
    normalizePriceHistory(
      [optcgHistoryRecord({ card_set_id: "OP97-099" })],
      selection,
    ).status,
  ).toBe("unavailable");
  expect(
    normalizePriceHistory(
      [optcgHistoryRecord(), optcgHistoryRecord()],
      selection,
    ),
  ).toMatchObject({ status: "unavailable", points: [] });
});
it("retains missing and invalid slots as null while preserving independent metrics and true zero", () => {
  const result = normalizePriceHistory(
    [
      optcgHistoryRecord({
        Day1_Market_Price: 0,
        Day2_Market_Price: null,
        Day3_Market_Price: "NULL",
        Day4_Market_Price: "1.50",
        Day5_Market_Price: -1,
        Day6_Market_Price: Infinity,
      }),
    ],
    selection,
  );
  expect(result.points.slice(0, 6).map((p) => p.market)).toEqual([
    0,
    null,
    null,
    null,
    null,
    null,
  ]);
  expect(result.points[1].inventory).toBe(2.2);
  expect(result.issues).toHaveLength(3);
});
it("does not invent a flat history from the last quote and does not date slots from date_scraped", () => {
  expect(
    normalizePriceHistory(
      [
        {
          card_set_id: "OP97-010",
          card_image_id: "OP97-010",
          market_price: 2.5,
        },
      ],
      selection,
    ),
  ).toMatchObject({ status: "empty", sourceDate: null });
  const result = normalizePriceHistory(
    [optcgHistoryRecord({ date_scraped: "yesterday" })],
    selection,
  );
  expect(result.sourceDate).toBeNull();
  expect(result.points[0].slot).toBe("Day1");
  expect(result.issues).toHaveLength(1);
});
it("bounds and validates history arrays and ignores unrelated malformed rows", () => {
  expect(() => normalizePriceHistory({}, selection)).toThrow();
  expect(() =>
    normalizePriceHistory(
      Array.from({ length: 10001 }, () => null),
      selection,
    ),
  ).toThrow();
  expect(
    normalizePriceHistory([null, "bad", optcgHistoryRecord()], selection)
      .status,
  ).toBe("available");
});
it("extracts only provider identities and retains the printing category", () => {
  expect(historySelection("OP97-010", "optcg_sets_OP97-010_p1")).toEqual({
    ...selection,
    external_id: "optcg_sets_OP97-010_p1",
  });
  expect(historySelection("OP97-010", null)).toBeNull();
  expect(historySelection("OP97-010", "optcg_sets_../secrets")).toBeNull();
});
it("uses the documented set/starter history endpoints, with source identity validation", async () => {
  const transport = vi.fn<OptcgTransport>(async () =>
    Response.json([optcgHistoryRecord()]),
  );
  const api = new OptcgClient(transport);
  expect((await api.priceHistory(selection)).status).toBe("available");
  expect(transport.mock.calls[0][0]).toBe(
    "https://optcgapi.com/api/sets/card/twoweeks/OP97-010/",
  );
  await api.priceHistory({
    card_number: "ST97-010",
    external_id: "optcg_decks_ST97-010",
    family: "decks",
  });
  expect(transport.mock.calls[1][0]).toBe(
    "https://optcgapi.com/api/decks/card/twoweeks/ST97-010/",
  );
  await expect(
    api.priceHistory({ ...selection, family: "decks" }),
  ).rejects.toMatchObject({ code: "INVALID_ID" });
  await expect(
    api.priceHistory({ ...selection, card_number: "../../secrets" }),
  ).rejects.toThrow();
  expect(transport).toHaveBeenCalledTimes(2);
});
it("does not guess endpoints for promo or DON histories", async () => {
  const transport = vi.fn();
  const api = new OptcgClient(transport);
  expect(
    (
      await api.priceHistory({
        ...selection,
        family: "promos",
        external_id: "optcg_promos_OP97-010",
      })
    ).status,
  ).toBe("unavailable");
  expect(
    (
      await api.priceHistory({
        card_number: "DON!!",
        family: "don",
        external_id: "optcg_don_don_1",
      })
    ).status,
  ).toBe("unavailable");
  expect(transport).not.toHaveBeenCalled();
});
it.each([500, 429, 404])(
  "reports a %i history failure with one request and no automatic fallback/retry",
  async (status) => {
    const transport = vi.fn(async () => new Response(null, { status }));
    await expect(
      new OptcgClient(transport).priceHistory(selection),
    ).rejects.toMatchObject({ status });
    expect(transport).toHaveBeenCalledOnce();
  },
);
it("rejects invalid history JSON and streaming size overflow", async () => {
  await expect(
    new OptcgClient(async () => new Response("not JSON")).priceHistory(
      selection,
    ),
  ).rejects.toMatchObject({ code: "INVALID_HISTORY" });
  await expect(
    new OptcgClient(async () => new Response("x".repeat(5000001))).priceHistory(
      selection,
    ),
  ).rejects.toMatchObject({ code: "INVALID_HISTORY" });
});

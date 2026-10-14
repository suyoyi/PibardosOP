import { describe, it, expect, vi } from "vitest";
import {
  OptcgClient,
  normalizeOptcgCard,
  normalizeOptcgRecords,
  selectDefaultOptcgPrinting,
  safeOptcgImage,
  type OptcgTransport,
} from "../../src/domain/optcg";
import { parseDecklist } from "../../src/domain/deck-import";
import { syntheticCard } from "../fixtures/cards";
import { optcgRecord } from "../fixtures/optcg";
describe("OPTCG provider documented data", () => {
  it("normalizes strings and both null representations without assigning an undocumented currency", () => {
    const card = normalizeOptcgCard(optcgRecord(), "sets");
    expect(card).toMatchObject({
      external_id: "optcg_sets_OP97-010",
      card_type: "character",
      card_number: "OP97-010",
      colors: ["red"],
      cost: 3,
      power: 5000,
      counter: 1000,
      life: null,
      language: "en",
      source_date: "2026-01-02",
      traits: ["Synthetic trait block"],
    });
    expect(card.prices).toEqual([
      { metric: "market_price", amount: 2.5, currency: null },
    ]);
    expect(
      normalizeOptcgCard(
        optcgRecord({ market_price: null, inventory_price: null }),
        "sets",
      ).prices,
    ).toEqual([]);
  });
  it.each([
    { card_type: null },
    { card_type: "Made-up" },
    { card_color: "Orange" },
    { card_cost: "many" },
    { card_power: -1 },
    { date_scraped: "yesterday" },
    { market_price: -1 },
    { market_price: "2.5" },
    { card_set_id: "BAD" },
  ])("reports invalid fields %j", (patch) => {
    expect(() => normalizeOptcgCard(optcgRecord(patch), "sets")).toThrow();
  });
  it("retains distinct variants and selects only the actual base or a unique exact printing", () => {
    const base = normalizeOptcgCard(optcgRecord(), "sets"),
      alt = normalizeOptcgCard(
        optcgRecord({ card_image_id: "OP97-010_p1" }),
        "sets",
      ),
      alt2 = normalizeOptcgCard(
        optcgRecord({ card_image_id: "OP97-010_p2" }),
        "sets",
      );
    expect(base.external_id).not.toBe(alt.external_id);
    expect(selectDefaultOptcgPrinting([alt, base], "OP97-010")).toBe(base);
    expect(selectDefaultOptcgPrinting([alt, alt2], "OP97-010")).toBeNull();
    expect(selectDefaultOptcgPrinting([base], "OP97-099")).toBeNull();
  });
  it("uses stable local fingerprints for missing IDs, without including changing prices or effects", () => {
    const original = normalizeOptcgCard(
      optcgRecord({ card_image_id: null, card_image: null }),
      "promos",
    );
    const refreshed = normalizeOptcgCard(
      optcgRecord({
        card_image_id: null,
        market_price: 9,
        card_text: "Changed",
        card_image: null,
      }),
      "promos",
    );
    expect(refreshed.external_id).toBe(original.external_id);
    expect(original.image_url).toBeNull();
    expect(original.is_base).toBe(false);
    expect(
      normalizeOptcgCard(
        optcgRecord({ card_image_id: null, card_name: "Different printing" }),
        "promos",
      ).external_id,
    ).not.toBe(original.external_id);
  });
  it("reports duplicate identities and malformed rows without silently dropping their existence", () => {
    const r = normalizeOptcgRecords(
      [optcgRecord(), optcgRecord(), optcgRecord({ card_type: null })],
      "sets",
    );
    expect(r.cards).toHaveLength(0);
    expect(r.issues).toHaveLength(2);
    expect(r.received).toBe(3);
  });
  it("keeps DON separate and does not invent missing type-specific values", () => {
    const r = normalizeOptcgCard(
      {
        card_name: "Synthetic DON",
        card_type: "DON!!",
        card_image_id: "don_test",
        market_price: null,
      },
      "don",
    );
    expect(r).toMatchObject({
      card_number: "DON!!",
      card_type: "don",
      colors: [],
      cost: null,
      power: null,
      life: null,
      image_url: null,
    });
  });
  it.each([
    "http://optcgapi.com/media/static/Card_Images/a.jpg",
    "https://evil.invalid/media/static/Card_Images/a.jpg",
    "https://optcgapi.com:4430/media/static/Card_Images/a.jpg",
    "https://optcgapi.com/media/static/Card_Images/a.svg",
    "https://optcgapi.com/media/static/Card_Images/a.jpg?key=x",
    "https://optcgapi.com/media/static/Card_Images/../a.jpg",
  ])("blocks unsafe image references %s", (url) => {
    expect(safeOptcgImage(url)).toBeNull();
    const card = normalizeOptcgCard(optcgRecord({ card_image: url }), "sets");
    expect(card.image_url).toBeNull();
    expect(card.warnings).toHaveLength(1);
  });
  it("routes printed codes, groups and collection aliases to documented GET endpoints without credentials", async () => {
    const transport = vi.fn<OptcgTransport>(async () => Response.json([])),
      api = new OptcgClient(transport);
    await api.cards("ST01-001");
    await api.cards("P-001");
    await api.search("OP97-010", "promos");
    await api.set("ST97");
    await api.set("PRB01");
    await api.search("Synthetic & name");
    expect(transport.mock.calls.map((c) => c[0])).toEqual([
      "https://optcgapi.com/api/decks/card/ST01-001/",
      "https://optcgapi.com/api/promos/card/P-001/",
      "https://optcgapi.com/api/promos/card/OP97-010/",
      "https://optcgapi.com/api/decks/ST-97/",
      "https://optcgapi.com/api/sets/PRB-01/",
      "https://optcgapi.com/api/sets/filtered/?card_name=Synthetic%20%26%20name",
    ]);
    const init = transport.mock.calls[0][1];
    expect(init.method).toBe("GET");
    expect(init.redirect).toBe("error");
    expect(new Headers(init.headers).has("X-API-Key")).toBe(false);
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
  });
  it.each([404, 429, 503])(
    "handles %i without retries or exposing upstream errors",
    async (status) => {
      const transport = vi.fn<OptcgTransport>(
          async () => new Response("Private upstream error", { status }),
        ),
        api = new OptcgClient(transport);
      await expect(api.cards("OP97-010")).rejects.toMatchObject({ status });
      expect(transport).toHaveBeenCalledOnce();
    },
  );
  it("uses stream bounds and MIME checks for metadata and artwork", async () => {
    const api = new OptcgClient(
      async () =>
        new Response(new Uint8Array(5_000_001), {
          headers: { "Content-Type": "image/png" },
        }),
    );
    await expect(api.cards("OP97-010")).rejects.toMatchObject({
      code: "INVALID_DATA",
    });
    await expect(
      api.image("https://optcgapi.com/media/static/Card_Images/a.jpg"),
    ).rejects.toMatchObject({ code: "SIZE_LIMIT" });
    await expect(
      new OptcgClient(
        async () =>
          new Response("<svg/>", {
            headers: { "Content-Type": "image/svg+xml" },
          }),
      ).image("https://optcgapi.com/media/static/Card_Images/a.jpg"),
    ).rejects.toMatchObject({ code: "INVALID_IMAGE" });
  });
});

it("imports the explicitly identified base even when an alternate was the first canonical root", () => {
  const alternate = syntheticCard(40, {
      source: "optcgapi",
      card_number: "OP97-010",
      printing_code: "OP97-010_p1",
    }),
    base = syntheticCard(41, {
      source: "optcgapi",
      card_number: "OP97-010",
      printing_code: "OP97-010",
      canonical_card_id: alternate.id,
    });
  expect(
    parseDecklist("4 OP97-010", [alternate, base]).entries[0].card.id,
  ).toBe(base.id);
  expect(
    parseDecklist("4 OP97-010", [base, alternate]).entries[0].card.id,
  ).toBe(base.id);
});

it("retrieves leaders through the documented type filter and never queries DON for a leader", async () => {
  const transport = vi.fn<OptcgTransport>(async () => Response.json([])),
    api = new OptcgClient(transport);
  await api.leaders("sets");
  await api.leaders("decks");
  await api.leaders("promos");
  expect(transport.mock.calls.map((c) => c[0])).toEqual([
    "https://optcgapi.com/api/sets/filtered/?card_type=Leader",
    "https://optcgapi.com/api/decks/filtered/?card_type=Leader",
    "https://optcgapi.com/api/promos/filtered/?card_type=Leader",
  ]);
  await api.leaders("don");
  expect(transport).toHaveBeenCalledTimes(3);
});

it("normalizes promo collection aliases for the documented set_id filter", async () => {
  const transport = vi.fn<OptcgTransport>(async () => Response.json([])),
    api = new OptcgClient(transport);
  await api.promoCollection("OP-01");
  expect(transport.mock.calls[0][0]).toBe(
    "https://optcgapi.com/api/promos/filtered/?set_id=OP01",
  );
});

describe("named expansion and guided filters", () => {
  it("reads actual set/starter names, retains hybrid codes and reports malformed metadata", async () => {
    const transport: OptcgTransport = async (url) =>
      Response.json(
        url.includes("allSets")
          ? [
              { set_id: "OP-17", set_name: "Synthetic named expansion" },
              { set_id: "OP14-EB04", set_name: "Synthetic combined expansion" },
              { set_id: "bad", set_name: "Unusable" },
            ]
          : [
              {
                structure_deck_id: "ST-01",
                structure_deck_name: "Synthetic starter name",
              },
            ],
      );
    const result = await new OptcgClient(transport).expansions();
    expect(result.expansions).toEqual([
      { id: "OP-17", name: "Synthetic named expansion", family: "sets" },
      { id: "OP14-EB04", name: "Synthetic combined expansion", family: "sets" },
      { id: "ST-01", name: "Synthetic starter name", family: "decks" },
    ]);
    expect(result.issues).toHaveLength(1);
  });
  it("keeps successfully fetched expansion names when another group fails", async () => {
    const result = await new OptcgClient(async (url) =>
      url.includes("allSets")
        ? Response.json([{ set_id: "OP-01", set_name: "Synthetic set" }])
        : new Response(null, { status: 429 }),
    ).expansions();
    expect(result.expansions).toHaveLength(1);
    expect(result.issues).toHaveLength(1);
  });
  it("uses documented color/set/cost/name parameters and normalizes short code searches", async () => {
    const paths: string[] = [];
    const api = new OptcgClient(async (url) => {
      paths.push(url);
      return Response.json([]);
    });
    await api.filtered("sets", {
      search: "Luffy",
      set: "OP-17",
      color: "red",
      cost: "0",
    });
    const url = new URL(paths[0]);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      card_name: "Luffy",
      set_id: "OP-17",
      color: "red",
      card_cost: "0",
    });
    await api.search("op17-99");
    expect(paths[1]).toBe("https://optcgapi.com/api/sets/card/OP17-099/");
    await expect(api.filtered("sets", { color: "invalid" })).rejects.toThrow();
  });
});

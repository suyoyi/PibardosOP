import { describe, it, expect, vi } from "vitest";
import {
  BerryWalletClient,
  normalizeBerryCard,
  type BerryTransport,
} from "../../src/domain/berrywallet";
import { berryRecord } from "../fixtures/berrywallet";
const json = (data: unknown) => Response.json(data);
const client = (response: () => Response) =>
  new BerryWalletClient(
    "synthetic-test-key",
    vi.fn(async () => response()),
  );
describe("BerryWallet documented adapter with synthetic data", () => {
  it("normalizes numeric fields, colors, traits and nulls without invented life or prices", () => {
    const card = normalizeBerryCard(berryRecord(), "en");
    expect(card).toMatchObject({
      card_number: "OP97-010",
      card_type: "character",
      colors: ["red", "green"],
      cost: 3,
      power: 5000,
      counter: 1000,
      life: null,
      language: "en",
      traits: ["Synthetic trait", "Test trait"],
    });
    expect(card.prices).toEqual([
      { market: "cardmarket", currency: "EUR", metric: "avg", amount: 2.5 },
      { market: "cardmarket", currency: "EUR", metric: "low", amount: 1 },
      {
        market: "tcgplayer",
        currency: "USD",
        metric: "low_price",
        amount: 1.25,
      },
    ]);
    expect(
      normalizeBerryCard(
        berryRecord({ tcgplayer: null, cardmarket: null }),
        "en",
      ).prices,
    ).toEqual([]);
  });
  it.each([
    { card_type: null },
    { card_type: "Unknown" },
    { ext_color: "Orange" },
    { ext_cost: "three" },
    { ext_counterplus: -1 },
    { cardmarket: { prices: { low: -2 } } },
    { card_number: "BROKEN" },
  ])("rejects incomplete or malformed metadata %j", (patch) => {
    expect(() => normalizeBerryCard(berryRecord(patch), "en")).toThrow();
  });
  it("keeps alternate printing IDs separate and never substitutes printed-number artwork", () => {
    const a = normalizeBerryCard(berryRecord(), "en"),
      b = normalizeBerryCard(
        berryRecord({
          id: "op_synthetic_printing_b",
          image_url: "https://untrusted.invalid/images/OP97-010",
        }),
        "en",
      );
    expect(a.card_number).toBe(b.card_number);
    expect(a.external_id).not.toBe(b.external_id);
    expect(b.image_path).toBe("/images/op_synthetic_printing_b");
  });
  it("sends server credentials only in headers and prevents redirects", async () => {
    const transport = vi.fn<BerryTransport>(async () =>
      json({ data: [berryRecord()], total: 14, page: 2, limit: 12 }),
    );
    const api = new BerryWalletClient("synthetic-secret", transport);
    const result = await api.search("Synthetic & name", 2);
    expect(result.total).toBe(14);
    expect(transport).toHaveBeenCalledOnce();
    const [url, init] = transport.mock.calls[0];
    expect(url).toBe(
      "https://api.pokewallet.io/op/search?q=Synthetic%20%26%20name&limit=12&page=2",
    );
    expect(url).not.toContain("synthetic-secret");
    expect(init.redirect).toBe("error");
    expect(new Headers(init.headers).get("X-API-Key")).toBe("synthetic-secret");
  });
  it("records skipped collection entries, full provider totals and verified collection metadata", async () => {
    const api = client(() =>
      json({
        data: [berryRecord(), berryRecord({ card_type: null })],
        total: 201,
        page: 1,
        limit: 200,
        set: { set_code: "OP97", language: "jp" },
      }),
    );
    const set = await api.set("1234", 1, "jp");
    expect(set.received).toBe(2);
    expect(set.total).toBe(201);
    expect(set.data).toHaveLength(1);
    expect(set.errors).toHaveLength(1);
    expect(set.data[0]).toMatchObject({ language: "ja", set_code: "OP97" });
  });
  it("rejects a collection with a different language instead of relabeling it", async () => {
    await expect(
      client(() =>
        json({
          data: [berryRecord()],
          total: 1,
          set: { set_code: "OP97", language: "en" },
        }),
      ).set("OP97", 1, "jp"),
    ).rejects.toMatchObject({ code: "LANGUAGE_MISMATCH" });
  });
  it.each([401, 404, 429, 503])(
    "explains HTTP %i without leaking upstream bodies or retrying",
    async (status) => {
      const transport = vi.fn<BerryTransport>(
        async () =>
          new Response("synthetic-secret", {
            status,
            headers: { "Retry-After": "60" },
          }),
      );
      const api = new BerryWalletClient("synthetic-secret", transport);
      await expect(api.search("OP97-010")).rejects.toMatchObject({
        status,
        retryAfter: 60,
      });
      expect(transport).toHaveBeenCalledOnce();
      try {
        await api.search("OP97-010");
      } catch (e) {
        expect(String(e)).not.toContain("synthetic-secret");
      }
    },
  );
  it("stops a batch when the hourly budget reaches zero", async () => {
    const transport = vi.fn<BerryTransport>(
      async () =>
        new Response(JSON.stringify({ data: [], total: 0 }), {
          headers: { "X-RateLimit-Remaining-Hour": "0" },
        }),
    );
    const api = new BerryWalletClient("synthetic-test-key", transport);
    await api.search("OP97-010");
    await expect(api.search("OP97-011")).rejects.toMatchObject({
      code: "RATE_LIMIT",
    });
    expect(transport).toHaveBeenCalledOnce();
  });
  it("handles absent credentials and network failures safely", async () => {
    const transport = vi.fn<BerryTransport>(async () => {
      throw new Error("synthetic-secret");
    });
    await expect(
      new BerryWalletClient("", transport).search("OP97-010"),
    ).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
    expect(transport).not.toHaveBeenCalled();
    await expect(
      new BerryWalletClient("synthetic-secret", transport).search("OP97-010"),
    ).rejects.toMatchObject({ code: "NETWORK" });
  });
  it("validates binary images, fixed-host paths and response size", async () => {
    const api = client(
      () =>
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { "Content-Type": "image/png" },
        }),
    );
    expect(
      (await api.image("/images/op_synthetic_printing_a")).body.byteLength,
    ).toBe(3);
    await expect(
      api.image("https://untrusted.invalid/image"),
    ).rejects.toMatchObject({ code: "INVALID_PATH" });
    await expect(api.image("/images/../private")).rejects.toMatchObject({
      code: "INVALID_PATH",
    });
    await expect(
      client(
        () =>
          new Response("<svg/>", {
            headers: { "Content-Type": "image/svg+xml" },
          }),
      ).image("/images/op_synthetic_printing_a"),
    ).rejects.toMatchObject({ code: "INVALID_IMAGE" });
    await expect(
      client(
        () =>
          new Response(new Uint8Array(5_000_001), {
            headers: { "Content-Type": "image/png" },
          }),
      ).image("/images/op_synthetic_printing_a"),
    ).rejects.toMatchObject({ code: "INVALID_IMAGE" });
  });
  it("rejects invalid JSON and oversized datasets", async () => {
    await expect(
      client(() => new Response("invalid")).search("OP97-010"),
    ).rejects.toMatchObject({ code: "INVALID_DATA" });
    await expect(
      client(() => new Response(" ".repeat(5_000_001))).search("OP97-010"),
    ).rejects.toMatchObject({ code: "INVALID_DATA" });
  });
});

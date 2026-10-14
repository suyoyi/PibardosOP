import { it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { BerryWalletProvider } from "../../src/lib/berrywallet";
import {
  BerryWalletClient,
  type BerryTransport,
} from "../../src/domain/berrywallet";
import type { AppClient } from "../../src/lib/data";
import { berryRecord } from "../fixtures/berrywallet";
function database() {
  const rpc = vi.fn(async () => ({
    data: "00000000-0000-4000-8000-000000000001",
    error: null,
  }));
  return { rpc, db: { rpc } as unknown as AppClient };
}
it("synchronizes every page by full provider total, reports incomplete records and never counts them as persisted", async () => {
  const first = Array.from({ length: 200 }, (_, i) =>
    berryRecord({
      id: `op_synthetic_${i}`,
      card_type: i === 199 ? null : "Character",
    }),
  );
  const transport = vi.fn<BerryTransport>(async (url) =>
    Response.json({
      data: url.includes("page=1&")
        ? first
        : [berryRecord({ id: "op_synthetic_last" })],
      total: 201,
      set: { set_code: "OP97", language: "en" },
    }),
  );
  const { db, rpc } = database();
  const result = await new BerryWalletProvider(
    db,
    "en",
    "OP97",
    new BerryWalletClient("synthetic-test-key", transport),
  ).synchronize();
  expect(transport).toHaveBeenCalledTimes(2);
  expect(transport.mock.calls[1][0]).toContain("page=2&language=en");
  expect(result.imported).toBe(200);
  expect(rpc).toHaveBeenCalledTimes(200);
  expect(result.message).toContain("1 entradas incompletas");
});
it("retains previously persisted pages when a batch exhausts quota and makes no extra request", async () => {
  const transport = vi.fn<BerryTransport>(
    async () =>
      new Response(
        JSON.stringify({
          data: [berryRecord()],
          total: 201,
          set: { set_code: "OP97", language: "en" },
        }),
        { headers: { "X-RateLimit-Remaining-Hour": "0" } },
      ),
  );
  const { db, rpc } = database();
  await expect(
    new BerryWalletProvider(
      db,
      "en",
      "OP97",
      new BerryWalletClient("synthetic-test-key", transport),
    ).synchronize(),
  ).rejects.toMatchObject({ code: "RATE_LIMIT" });
  expect(rpc).toHaveBeenCalledOnce();
  expect(transport).toHaveBeenCalledOnce();
});
it("rejects empty truncated pages rather than claiming complete synchronization", async () => {
  const { db, rpc } = database(),
    api = new BerryWalletClient("synthetic-test-key", async () =>
      Response.json({
        data: [],
        total: 201,
        set: { set_code: "OP97", language: "en" },
      }),
    );
  await expect(
    new BerryWalletProvider(db, "en", "OP97", api).synchronize(),
  ).rejects.toMatchObject({ code: "INCOMPLETE_PAGE" });
  expect(rpc).not.toHaveBeenCalled();
});
it("refuses persistence failures without claiming the collection was saved", async () => {
  const { db, rpc } = database();
  rpc.mockResolvedValueOnce({
    data: null,
    error: { message: "synthetic failure" },
  } as never);
  const api = new BerryWalletClient("synthetic-test-key", async () =>
    Response.json({
      data: [berryRecord()],
      total: 1,
      set: { set_code: "OP97", language: "en" },
    }),
  );
  await expect(
    new BerryWalletProvider(db, "en", "OP97", api).synchronize(),
  ).rejects.toMatchObject({ code: "PERSISTENCE" });
});

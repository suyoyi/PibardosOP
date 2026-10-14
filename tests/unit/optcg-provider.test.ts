import { it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { OptcgClient } from "../../src/domain/optcg";
import { OptcgProvider } from "../../src/lib/optcg";
import type { AppClient } from "../../src/lib/data";
import { optcgRecord } from "../fixtures/optcg";
function database() {
  const rpc = vi.fn(async () => ({
    data: "00000000-0000-4000-8000-000000000001",
    error: null,
  }));
  return { rpc, db: { rpc } as unknown as AppClient };
}
it("persists complete set records and reports all malformed entries", async () => {
  const { db, rpc } = database(),
    transport = vi.fn(async () =>
      Response.json([
        optcgRecord(),
        optcgRecord({ card_image_id: "OP97-010_p1" }),
        optcgRecord({ card_type: null }),
      ]),
    ),
    api = new OptcgClient(transport);
  const result = await new OptcgProvider(db, "OP97", api).synchronize();
  expect(result.imported).toBe(2);
  expect(result.message).toContain("Avisos (1)");
  expect(rpc).toHaveBeenCalledTimes(2);
  expect(transport).toHaveBeenCalledOnce();
});
it("refuses a selected printing that does not match the upstream record", async () => {
  const { db, rpc } = database(),
    api = new OptcgClient(async () => Response.json([optcgRecord()]));
  await expect(
    new OptcgProvider(db, undefined, api).importCard(
      "OP97-010",
      "optcg_sets_OP97-010_p99",
      "sets",
    ),
  ).rejects.toMatchObject({ code: "PRINTING_NOT_FOUND" });
  expect(rpc).not.toHaveBeenCalled();
});
it("reports failed cache writes rather than a successful synchronization", async () => {
  const { db, rpc } = database();
  rpc.mockResolvedValueOnce({
    data: null,
    error: { message: "Synthetic error" },
  } as never);
  const api = new OptcgClient(async () => Response.json([optcgRecord()]));
  await expect(
    new OptcgProvider(db, "OP97", api).synchronize(),
  ).rejects.toMatchObject({ code: "PERSISTENCE" });
});

it("refuses a response whose printed number differs from the requested code", async () => {
  const { db, rpc } = database(),
    api = new OptcgClient(async () =>
      Response.json([optcgRecord({ card_set_id: "OP97-099" })]),
    );
  await expect(
    new OptcgProvider(db, undefined, api).importCard(
      "OP97-010",
      "optcg_sets_OP97-010",
      "sets",
    ),
  ).rejects.toMatchObject({ code: "PRINTING_NOT_FOUND" });
  expect(rpc).not.toHaveBeenCalled();
});

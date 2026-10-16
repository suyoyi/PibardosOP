import { beforeEach, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { auth, history } = vi.hoisted(() => ({
  auth: vi.fn(),
  history: vi.fn(),
}));
vi.mock("../../src/lib/supabase/server", () => ({ requireUser: auth }));
vi.mock("../../src/lib/optcg", () => ({
  optcgClient: () => ({ priceHistory: history }),
}));
import { getCardPriceHistory } from "../../src/app/(private)/cards/price-history-actions";
import { OptcgError } from "../../src/domain/optcg";
const selection = {
  card_number: "OP97-010",
  external_id: "optcg_sets_OP97-010",
  family: "sets",
};
beforeEach(() => {
  vi.resetAllMocks();
  auth.mockResolvedValue({});
});
it("requires authentication before consulting any public history data", async () => {
  auth.mockRejectedValue(new Error("unauthenticated"));
  await expect(getCardPriceHistory(selection)).rejects.toThrow(
    "unauthenticated",
  );
  expect(history).not.toHaveBeenCalled();
});
it("rejects untrusted source mismatches, malformed numbers and extra fields before network access", async () => {
  for (const input of [
    { ...selection, family: "decks" },
    { ...selection, card_number: "../../secrets" },
    { ...selection, url: "https://example.com" },
  ])
    expect(await getCardPriceHistory(input)).toHaveProperty("error");
  expect(history).not.toHaveBeenCalled();
});
it("returns normalized selected public metadata without a service-role or persistence operation", async () => {
  history.mockResolvedValue({
    status: "empty",
    points: [],
    issues: [],
    sourceDate: null,
  });
  expect(await getCardPriceHistory(selection)).toMatchObject({
    status: "empty",
  });
  expect(history).toHaveBeenCalledWith(selection);
});
it("reports provider quota/transport failures as actionable errors", async () => {
  history
    .mockRejectedValueOnce(
      new OptcgError("RATE_LIMIT", "Consulta limitada", 429),
    )
    .mockRejectedValueOnce(new Error("Sensitive upstream content"));
  expect(await getCardPriceHistory(selection)).toEqual({
    error: "Consulta limitada",
  });
  const result = await getCardPriceHistory(selection);
  expect(result).toHaveProperty("error");
  expect(JSON.stringify(result)).not.toContain("Sensitive upstream content");
});

import { beforeEach, afterEach, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("../../src/lib/optcg", () => ({
  optcgClient: () => ({ catalog: load }),
}));
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubEnv("OPTCG_CACHE_SECONDS", "3600");
  load.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

it("shares in-flight public metadata and expires it without retaining user data", async () => {
  load.mockResolvedValue({ cards: [], issues: [], received: 0 });
  const { publicCatalog } = await import("../../src/lib/public-catalog");
  const first = publicCatalog();
  expect(publicCatalog()).toBe(first);
  await first;
  await publicCatalog();
  expect(load).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(3600001);
  await publicCatalog();
  expect(load).toHaveBeenCalledTimes(2);
});

it("uses a short bounded cache for partial failure and performs no automatic retry", async () => {
  load.mockResolvedValue({
    cards: [],
    issues: ["sets: provider unavailable"],
    received: 0,
  });
  const { publicCatalog } = await import("../../src/lib/public-catalog");
  await publicCatalog();
  vi.advanceTimersByTime(59000);
  await publicCatalog();
  expect(load).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(2000);
  expect(load).toHaveBeenCalledTimes(1);
  await publicCatalog();
  expect(load).toHaveBeenCalledTimes(2);
});

it("disables public snapshot caching for controlled tests and drops rejected loads", async () => {
  load
    .mockRejectedValueOnce(new Error("unavailable"))
    .mockResolvedValue({ cards: [], issues: [], received: 0 });
  const { publicCatalog } = await import("../../src/lib/public-catalog");
  await expect(publicCatalog()).rejects.toThrow("unavailable");
  await publicCatalog();
  vi.stubEnv("OPTCG_CACHE_SECONDS", "0");
  await publicCatalog();
  await publicCatalog();
  expect(load).toHaveBeenCalledTimes(4);
});

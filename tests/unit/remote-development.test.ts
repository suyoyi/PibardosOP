import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("remote preview origin boundary", () => {
  it("keeps default origin protection outside Codespaces", async () => {
    vi.stubEnv("CODESPACE_NAME", "");
    const { default: config } = await import("../../next.config");
    expect(config.allowedDevOrigins).toBeUndefined();
    expect(config.experimental?.serverActions).toBeUndefined();
  });
  it("trusts only the current Codespace's exact forwarded app hostname", async () => {
    vi.stubEnv("CODESPACE_NAME", "pibardos-example-123");
    vi.stubEnv("GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN", "app.github.dev");
    const { default: config } = await import("../../next.config");
    const expected = ["pibardos-example-123-3000.app.github.dev"];
    expect(config.allowedDevOrigins).toEqual(expected);
    expect(config.experimental?.serverActions).toEqual({
      allowedOrigins: expected,
    });
  });
  it.each([
    ["*", "app.github.dev"],
    ["pibardos-example-123", "*.github.dev"],
    ["pibardos-example-123", "https://app.github.dev/path"],
  ])(
    "never turns malformed metadata into wildcard trust (%s, %s)",
    async (name, domain) => {
      vi.stubEnv("CODESPACE_NAME", name);
      vi.stubEnv("GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN", domain);
      const { default: config } = await import("../../next.config");
      expect(config.allowedDevOrigins).toBeUndefined();
      expect(config.experimental?.serverActions).toBeUndefined();
    },
  );
});

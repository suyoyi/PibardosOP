import { describe, expect, it } from "vitest";
import {
  loginSchema,
  signupSchema,
  safeReturnPath,
  googleCallbackUrl,
  googleSignInError,
} from "../../src/domain/auth";

describe("authentication input", () => {
  it("rejects malformed emails and missing passwords", () => {
    expect(
      loginSchema.safeParse({ email: "invalid", password: "" }).success,
    ).toBe(false);
  });
  it("requires a long password for registration without imposing a new policy on existing logins", () => {
    expect(
      signupSchema.safeParse({ email: "owner@example.com", password: "short" })
        .success,
    ).toBe(false);
    expect(
      loginSchema.safeParse({ email: "owner@example.com", password: "short" })
        .success,
    ).toBe(true);
    expect(
      signupSchema.safeParse({
        email: "owner@example.com",
        password: "a-long-test-password",
      }).success,
    ).toBe(true);
  });
  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/\nevil.example",
    "/login",
    "/auth/callback",
    undefined,
    ["/decks", "/matches"],
    { next: "/decks" },
    "/" + "a".repeat(2048),
  ])("rejects unsafe return path %s", (input) => {
    expect(safeReturnPath(input)).toBe("/");
  });
  it("keeps a local application return path", () =>
    expect(safeReturnPath("/decks?status=draft")).toBe("/decks?status=draft"));
});

describe("Google callback destinations", () => {
  it.each([
    "https://pibardos-op.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3100",
    "http://[::1]:3000",
  ])("accepts HTTPS or local development origin %s", (origin) => {
    const callback = googleCallbackUrl(origin, "/decks?view=grid#ignored");
    expect(callback?.origin).toBe(origin);
    expect(callback?.pathname).toBe("/auth/callback");
    expect(callback?.searchParams.get("next")).toBe("/decks?view=grid");
  });
  it.each([
    null,
    "null",
    "http://public.example",
    "https://user:password@public.example",
    "https://public.example/path",
    "https://public.example?query",
    "https://public.example#fragment",
    "javascript:alert(1)",
  ])("rejects malformed or insecure origins %s", (origin) => {
    expect(googleCallbackUrl(origin, "/")).toBeNull();
  });
  it("never puts an external return destination into a callback", () => {
    expect(
      googleCallbackUrl(
        "https://pibardos-op.vercel.app",
        "//external.example",
      )?.searchParams.get("next"),
    ).toBe("/");
  });
  it("displays only known error messages, never untrusted provider descriptions", () => {
    expect(googleSignInError("cancelled")).toContain("cancelado");
    expect(googleSignInError("failed")).toContain("este navegador");
    expect(googleSignInError("unavailable")).toContain("correo y contraseña");
    for (const input of [
      "__proto__",
      "toString",
      "<script>secret</script>",
      [],
      null,
    ])
      expect(googleSignInError(input)).toBeNull();
  });
});

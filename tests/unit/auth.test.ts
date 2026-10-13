import { describe, expect, it } from "vitest";
import {
  loginSchema,
  signupSchema,
  safeReturnPath,
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
  ])("rejects unsafe return path %s", (input) => {
    expect(safeReturnPath(input)).toBe("/");
  });
  it("keeps a local application return path", () =>
    expect(safeReturnPath("/decks?status=draft")).toBe("/decks?status=draft"));
});

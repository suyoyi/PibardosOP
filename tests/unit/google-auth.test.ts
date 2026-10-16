import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  headers: vi.fn(),
  client: vi.fn(),
  oauth: vi.fn(),
  exchange: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("../../src/lib/config", () => ({ getSupabaseConfig: mocks.config }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../../src/lib/supabase/server", () => ({
  createClient: mocks.client,
}));
import { signInWithGoogle } from "../../src/app/login/google-actions";
import { GET } from "../../src/app/auth/callback/route";

const origin = "https://pibardos-op.vercel.app";
const project = "https://synthetic.supabase.co";
const authorize = `${project}/auth/v1/authorize?provider=google`;
const fetchMock = vi.fn();
const request = (query: string) =>
  new NextRequest(`${origin}/auth/callback?${query}`);
const form = (next = "/decks?view=grid") => {
  const data = new FormData();
  data.set("next", next);
  return data;
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  mocks.config.mockReturnValue({ url: project, key: "synthetic-public-key" });
  mocks.headers.mockResolvedValue(new Headers({ origin }));
  mocks.client.mockResolvedValue({
    auth: {
      signInWithOAuth: mocks.oauth,
      exchangeCodeForSession: mocks.exchange,
    },
  });
  fetchMock.mockResolvedValue(Response.json({ external: { google: true } }));
  mocks.oauth.mockResolvedValue({ data: { url: authorize }, error: null });
  mocks.exchange.mockResolvedValue({
    data: { session: { user: { id: "synthetic-user" } } },
    error: null,
  });
  mocks.redirect.mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("Google sign-in action", () => {
  it("constructs PKCE OAuth with a safe app callback and minimal scopes", async () => {
    await expect(signInWithGoogle({}, form())).rejects.toThrow(
      `REDIRECT:${authorize}`,
    );
    expect(mocks.oauth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=%2Fdecks%3Fview%3Dgrid`,
        scopes: "openid email profile",
        queryParams: { prompt: "select_account" },
        skipBrowserRedirect: true,
      },
    });
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${project}/auth/v1/settings`);
    expect(options.cache).toBe("no-store");
  });
  it("does not start OAuth without configuration or a valid request origin", async () => {
    mocks.config.mockReturnValueOnce(null);
    expect(await signInWithGoogle({}, form())).toHaveProperty("error");
    mocks.headers.mockResolvedValueOnce(new Headers());
    expect(await signInWithGoogle({}, form())).toHaveProperty("error");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.oauth).not.toHaveBeenCalled();
  });
  it.each([
    { external: { google: false } },
    { external: {} },
    { unexpected: true },
    null,
  ])(
    "keeps email sign-in usable when the provider is unavailable: %j",
    async (settings) => {
      fetchMock.mockResolvedValue(Response.json(settings));
      expect(await signInWithGoogle({}, form())).toEqual({
        error: expect.stringContaining("correo y contraseña"),
      });
      expect(mocks.oauth).not.toHaveBeenCalled();
    },
  );
  it("hides upstream errors and supports failed or malformed settings responses", async () => {
    for (const response of [
      new Response("upstream-secret", { status: 503 }),
      new Response("invalid JSON"),
    ]) {
      fetchMock.mockResolvedValueOnce(response);
      expect(JSON.stringify(await signInWithGoogle({}, form()))).not.toContain(
        "upstream-secret",
      );
    }
    fetchMock.mockRejectedValueOnce(new Error("upstream-secret"));
    expect(await signInWithGoogle({}, form())).toHaveProperty("error");
    expect(mocks.oauth).not.toHaveBeenCalled();
  });
  it.each([
    "https://external.example/auth/v1/authorize?provider=google",
    `${project}/other?provider=google`,
    `${project}/auth/v1/authorize?provider=other`,
    "not-a-url",
    null,
  ])("rejects unexpected authorization destinations %s", async (url) => {
    mocks.oauth.mockResolvedValueOnce({ data: { url }, error: null });
    expect(await signInWithGoogle({}, form())).toHaveProperty("error");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("keeps SDK failure details out of the interface", async () => {
    mocks.oauth.mockResolvedValueOnce({
      data: { url: authorize },
      error: { message: "sensitive" },
    });
    expect(await signInWithGoogle({}, form())).toEqual({
      error: expect.not.stringContaining("sensitive"),
    });
    mocks.oauth.mockRejectedValueOnce(new Error("sensitive"));
    expect(await signInWithGoogle({}, form())).toHaveProperty("error");
  });
});

describe("OAuth callback", () => {
  it("exchanges the code, returns to a local screen and prevents caching or referrer leaks", async () => {
    const response = await GET(
      request("code=synthetic-code&next=%2Fdecks%3Fview%3Dgrid"),
    );
    expect(mocks.exchange).toHaveBeenCalledExactlyOnceWith("synthetic-code");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/decks?view=grid");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
  it.each([
    "",
    "code=",
    "code=one&code=two",
    `code=${"x".repeat(2049)}`,
    "error=access_denied&error_description=secret",
    "error=unexpected&code=unused",
  ])(
    "rejects missing/ambiguous/error callbacks before exchanging: %s",
    async (query) => {
      const response = await GET(request(query));
      const location = new URL(response.headers.get("location")!, origin);
      expect(location.pathname).toBe("/login");
      expect(location.searchParams.get("oauth_error")).toBe(
        query.startsWith("error=access_denied") ? "cancelled" : "failed",
      );
      expect(location.search).not.toContain("secret");
      expect(mocks.exchange).not.toHaveBeenCalled();
    },
  );
  it.each([
    "//external.example",
    "https://external.example",
    "/auth/callback",
    "/login",
    "/\\external.example",
  ])(
    "cannot redirect outside the application or back into auth: %s",
    async (next) => {
      const response = await GET(
        request(new URLSearchParams({ code: "fixture", next }).toString()),
      );
      expect(response.headers.get("location")).toBe("/");
    },
  );
  it("handles unavailable configuration without exchanging", async () => {
    mocks.config.mockReturnValue(null);
    const response = await GET(request("code=fixture"));
    expect(response.headers.get("location")).toBe(
      "/login?oauth_error=unavailable",
    );
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
  it("handles expired or missing PKCE sessions and transport errors without leaking details", async () => {
    for (const result of [
      { data: { session: null }, error: { message: "sensitive" } },
      { data: { session: null }, error: null },
    ]) {
      mocks.exchange.mockResolvedValueOnce(result);
      const response = await GET(
        request("code=sensitive-code&next=%2Fmatches%2Fnew"),
      );
      expect(response.headers.get("location")).toBe(
        "/login?oauth_error=failed&next=%2Fmatches%2Fnew",
      );
    }
    mocks.exchange.mockRejectedValueOnce(new Error("sensitive"));
    const response = await GET(request("code=sensitive-code"));
    expect(response.headers.get("location")).toBe("/login?oauth_error=failed");
  });
});

it("uses the real SSR SDK to persist the PKCE verifier and write session cookies on exchange", async () => {
  // Synthetic Auth response: this verifies the app/SDK cookie contract, not Google identity verification.
  const jar = new Map<string, string>();
  mocks.client.mockImplementation(async () =>
    createServerClient(project, "synthetic-public-key", {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (values) => {
          for (const { name, value } of values) jar.set(name, value);
        },
      },
    }),
  );
  await expect(signInWithGoogle({}, form())).rejects.toThrow("REDIRECT:");
  const destination = new URL(mocks.redirect.mock.calls[0][0]);
  expect(destination.searchParams.get("code_challenge_method")).toBe("s256");
  expect(destination.searchParams.get("code_challenge")).toBeTruthy();
  expect(
    [...jar].some(([key, value]) => key.endsWith("-code-verifier") && value),
  ).toBe(true);

  fetchMock.mockResolvedValueOnce(
    Response.json({
      access_token: "synthetic-access-token",
      refresh_token: "synthetic-refresh-token",
      token_type: "bearer",
      expires_in: 3600,
      user: {
        id: "00000000-0000-4000-8000-000000000001",
        aud: "authenticated",
        email: "oauth-fixture@example.com",
        app_metadata: {},
        user_metadata: {},
        created_at: "2026-10-16T00:00:00Z",
      },
    }),
  );
  const response = await GET(request("code=synthetic-code&next=%2Fdecks"));
  expect(response.headers.get("location")).toBe("/decks");
  const [tokenUrl, options] = fetchMock.mock.calls[1];
  expect(String(tokenUrl)).toBe(`${project}/auth/v1/token?grant_type=pkce`);
  expect(JSON.parse(options.body)).toMatchObject({
    auth_code: "synthetic-code",
    code_verifier: expect.any(String),
  });
  expect(JSON.parse(options.body).code_verifier.length).toBeGreaterThan(20);
  expect(jar.get("sb-synthetic-auth-token")).toBeTruthy();
  expect(jar.get("sb-synthetic-auth-token-code-verifier")).toBe("");
});

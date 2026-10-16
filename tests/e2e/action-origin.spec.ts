import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { connectLocalDatabase } from "../helpers/local-database";

test("only a trusted origin can register and open a private session", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("A test application URL is required.");
  const db = await connectLocalDatabase();
  const email = `origin-${randomUUID()}@example.com`;
  let payload:
    { url: string; headers: Record<string, string>; body: string } | undefined;
  let resolveCaptured: () => void;
  const captured = new Promise<void>((resolve) => {
    resolveCaptured = resolve;
  });
  try {
    // Capture the real action ID/payload without executing the browser submission.
    // Native HTTP replay preserves Origin exactly for the server-side CSRF test.
    await page.route("**/*", async (route) => {
      const request = route.request();
      if (request.method() === "POST" && request.headers()["next-action"]) {
        const body = request.postData();
        if (body === null) throw new Error("The action body is missing.");
        payload = { url: request.url(), headers: request.headers(), body };
        resolveCaptured();
        await route.abort();
      } else await route.continue();
    });
    await page.goto(`${baseURL}/login`);
    await page.getByRole("button", { name: "Crear mi primera cuenta" }).click();
    await page.getByLabel("Correo electrónico").fill(email);
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill(`Origin-${randomUUID()}`);
    await page
      .getByRole("button", { name: "Crear cuenta", exact: true })
      .click();
    await captured;
    if (!payload) throw new Error("The real Server Action was not captured.");
    const headers = { ...payload.headers };
    delete headers["content-length"];
    delete headers.cookie;

    const denied = await fetch(payload.url, {
      method: "POST",
      headers: { ...headers, origin: "https://untrusted.example" },
      body: payload.body,
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    expect(denied.status).toBeGreaterThanOrEqual(400);
    expect(
      (await db.query("select id from auth.users where email=$1", [email]))
        .rowCount,
    ).toBe(0);

    const origin = process.env.CODESPACE_NAME
      ? `https://${process.env.CODESPACE_NAME}-3000.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ?? "app.github.dev"}`
      : new URL(baseURL).origin;
    const allowed = await fetch(payload.url, {
      method: "POST",
      headers: { ...headers, origin },
      body: payload.body,
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    expect(allowed.status).toBeLessThan(400);
    expect(
      (await db.query("select id from auth.users where email=$1", [email]))
        .rowCount,
    ).toBe(1);
    const cookie = allowed.headers
      .getSetCookie()
      .map((value) => value.split(";", 1)[0])
      .join("; ");
    const dashboard = await fetch(`${baseURL}/`, {
      headers: { cookie },
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    expect(dashboard.status).toBe(200);
    expect(await dashboard.text()).toContain("Rumbo a la próxima partida");
  } finally {
    await db.query("delete from auth.users where email=$1", [email]);
    await db.end();
  }
});

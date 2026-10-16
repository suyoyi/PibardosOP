import { test, expect } from "@playwright/test";

test("Google Server Action rejects a foreign Origin before setting OAuth cookies", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("A test application URL is required.");
  let payload:
    { url: string; headers: Record<string, string>; body: string } | undefined;
  let resolveCaptured: () => void;
  const captured = new Promise<void>((resolve) => {
    resolveCaptured = resolve;
  });
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
  await page.goto("/login");
  await page.getByRole("button", { name: "Continuar con Google" }).click();
  await captured;
  if (!payload)
    throw new Error("The real Google Server Action was not captured.");
  const headers = { ...payload.headers };
  delete headers["content-length"];
  delete headers.cookie;
  const response = await fetch(payload.url, {
    method: "POST",
    headers: { ...headers, origin: "https://untrusted.example" },
    body: payload.body,
    redirect: "manual",
    signal: AbortSignal.timeout(5000),
  });
  expect(response.status).toBeGreaterThanOrEqual(400);
  expect(response.headers.getSetCookie()).toHaveLength(0);
});

test("Google can be selected without filling credentials; disabled local provider has a usable fallback", async ({
  page,
}) => {
  await page.goto("/login?next=%2Fmatches%2Fnew");
  const google = page.getByRole("form", { name: "Acceso con Google" });
  await google.getByRole("button", { name: "Continuar con Google" }).click();
  await expect(google.getByRole("alert")).toContainText(
    "Puedes entrar con tu correo y contraseña",
  );
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continuar con Google" }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("bad callbacks preserve a safe next path, show a friendly message and leave private routes protected", async ({
  page,
  request,
}) => {
  await page.goto(
    "/auth/callback?error=access_denied&error_description=untrusted-provider-message&next=%2Fmatches%2Fnew",
  );
  const access = page.getByRole("region", {
    name: "Tu próxima sesión empieza aquí",
  });
  await expect(access.getByRole("alert")).toContainText(
    "Has cancelado el acceso con Google",
  );
  await expect(
    page.locator('form[aria-label="Acceso con Google"] input[name="next"]'),
  ).toHaveValue("/matches/new");
  await expect(page.locator("body")).not.toContainText(
    "untrusted-provider-message",
  );
  for (const query of [
    "code=invalid-code&next=https://external.example",
    "code=one&code=two",
  ]) {
    const response = await request.get(`/auth/callback?${query}`, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(303);
    expect(
      new URL(response.headers().location, "https://pibardos.invalid").pathname,
    ).toBe("/login");
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["referrer-policy"]).toBe("no-referrer");
    expect(response.headers().location).not.toContain("external.example");
    expect(response.headers().location).not.toContain("invalid-code");
  }
  await page.goto("/matches");
  await expect(page).toHaveURL(/\/login/);
  await page.goto(
    "/login?next=%2Fdecks&next=%2Fmatches&oauth_error=%3Cscript%3Eraw-error%3C%2Fscript%3E",
  );
  await expect(
    page.getByRole("button", { name: "Continuar con Google" }),
  ).toBeVisible();
  await expect(access.getByRole("alert")).toHaveCount(0);
});

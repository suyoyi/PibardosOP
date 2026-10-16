import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { connectLocalDatabase } from "../helpers/local-database";

test("anonymous users are redirected and mobile login is accessible", async ({
  page,
}) => {
  await page.goto("/decks");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Entrar a mi espacio" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Correo electrónico").fill("missing@example.invalid");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("incorrect-test-password");
  await page.getByRole("button", { name: "Entrar a mi espacio" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "No se pudo acceder" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("register, navigate real empty data, logout and log back in", async ({
  page,
}) => {
  const email = `e2e-${randomUUID()}@example.com`;
  const password = `Test-${randomUUID()}`;
  try {
    await page.goto("/login");
    await page.getByRole("button", { name: "Crear mi primera cuenta" }).click();
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Crear cuenta", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Rumbo a la próxima partida" }),
    ).toBeVisible();
    await expect(page.getByText("Tus mazos", { exact: true })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Navegación principal" });
    for (const [label, empty] of [
      ["Mazos", "Una biblioteca por construir"],
      ["Cartas", "Cartas"],
      ["Partidas", "Todavía no hay resultados"],
      ["Estadísticas", "Necesitas partidas para ver tendencias"],
    ]) {
      await nav.getByRole("link", { name: label, exact: true }).click();
      await expect(page.getByRole("heading", { name: empty })).toBeVisible();
      if (label === "Cartas")
        await expect(
          page
            .getByRole("list", { name: "Resultados del catálogo" })
            .getByRole("button", { name: /^Ver carta / }),
        ).toHaveCount(5);
      if (label === "Estadísticas")
        for (const name of ["Al ir primero", "Al ir segundo"]) {
          const emptyOrder = page.getByRole("region", { name, exact: true });
          await expect(emptyOrder).toContainText("Victorias—");
          await expect(emptyOrder).toContainText("Derrotas—");
          await expect(emptyOrder).toContainText("n=0");
        }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    await page.getByRole("link", { name: "Ajustes", exact: true }).click();
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    await expect(
      page.locator('a[href^="/collection"], a[href^="/wishlist"]'),
    ).toHaveCount(0);
    for (const path of ["/collection", "/wishlist"]) {
      await page.goto(path);
      await expect(page).toHaveURL("/cards");
      await expect(
        page.getByRole("link", { name: /Mi colección|Lista de deseos/ }),
      ).toHaveCount(0);
    }
    await page.goto("/settings");
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar a mi espacio" }).click();
    await expect(
      page.getByRole("heading", { name: "Rumbo a la próxima partida" }),
    ).toBeVisible();
  } finally {
    const db = await connectLocalDatabase();
    await db.query("delete from auth.users where email=$1", [email]);
    await db.end();
  }
});

test("PWA has icons, a working service worker and a private-data-safe offline fallback", async ({
  page,
  context,
  request,
}) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/png");
  }
  await page.goto("/login");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  await context.setOffline(true);
  await page.goto("/decks");
  await expect(
    page.getByRole("heading", { name: "Estás sin conexión" }),
  ).toBeVisible();
  const cachedPaths = await page.evaluate(async () => {
    const paths: string[] = [];
    for (const key of await caches.keys())
      for (const request of await (await caches.open(key)).keys())
        paths.push(new URL(request.url).pathname);
    return paths;
  });
  expect(cachedPaths).not.toContain("/decks");
  expect(cachedPaths).not.toContain("/login");
  await context.setOffline(false);
});

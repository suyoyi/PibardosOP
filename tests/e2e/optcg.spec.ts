import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { connectLocalDatabase } from "../helpers/local-database";
test("mobile OPTCG search, selected printing, artwork, quote reuse, collection sync and confirmed deck import", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  const email = `optcg-e2e-${randomUUID()}@example.com`,
    password = `Test-${randomUUID()}`;
  try {
    await page.goto("/login");
    await page.getByRole("button", { name: "Crear mi primera cuenta" }).click();
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Crear cuenta", exact: true })
      .click();
    await expect(page).toHaveURL("/");
    await page.goto("/cards");
    await page.getByLabel("Buscar en OPTCG API").fill("OP97-010");
    await page.getByRole("button", { name: "Buscar en el proveedor" }).click();
    await expect(
      page.getByRole("heading", {
        name: "Synthetic OPTCG character parallel",
        exact: true,
      }),
    ).toBeVisible();
    // Select alternate first so canonical identity cannot stand in for base art.
    await page
      .getByRole("heading", {
        name: "Synthetic OPTCG character parallel",
        exact: true,
      })
      .locator("xpath=ancestor::form")
      .getByRole("button", { name: "Añadir al catálogo" })
      .click();
    await expect(page).toHaveURL(/\/cards\/[a-f0-9-]+\?saved=1/);
    await page.goto("/cards");
    await page.getByLabel("Buscar en OPTCG API").fill("OP97-010");
    await page.getByRole("button", { name: "Buscar en el proveedor" }).click();
    await page
      .getByRole("heading", { name: "Synthetic OPTCG character", exact: true })
      .locator("xpath=ancestor::form")
      .getByRole("button", { name: "Añadir al catálogo" })
      .click();
    await expect(page).toHaveURL(/\/cards\/[a-f0-9-]+\?saved=1/);
    const cardId = new URL(page.url()).pathname.split("/").at(-1)!;
    await expect(
      page.getByText(/Moneda no especificada por la API/),
    ).toBeVisible();
    await expect(page.getByText("2,5", { exact: true })).toBeVisible();
    const artwork = page.getByRole("img", {
      name: "Ilustración de Synthetic OPTCG character",
    });
    await expect(artwork).toBeVisible();
    await expect
      .poll(() => artwork.evaluate((e) => (e as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    const response = await page.request.get(`/api/cards/${cardId}/image`);
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect((await request.get(`/api/cards/${cardId}/image`)).status()).toBe(
      401,
    );
    await page
      .getByRole("button", { name: "Consultar precios de nuevo" })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "menos de 15 minutos" }),
    ).toBeVisible();
    await page.goto("/decks/new");
    await page.getByLabel("Nombre del mazo").fill("Synthetic OPTCG import");
    await page
      .getByLabel("Lista de texto")
      .fill("1 OP97-001\n4 OP97-010\n4 OP97-099");
    await page
      .getByRole("button", { name: "Revisar importación", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Resolver desconocidas con OPTCG API" })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "OP97-099 no está" }),
    ).toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: "no está disponible" }),
    ).toBeVisible();
    await page.getByLabel("Lista de texto").fill("1 OP97-001\n4 OP97-010");
    await page
      .getByRole("button", { name: "Revisar importación", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Mazo principal: 4 / 50" }),
    ).toBeVisible();
    await page.getByLabel(/He revisado las cantidades/).check();
    await page
      .getByRole("button", { name: "Guardar mazo", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Synthetic OPTCG import",
        exact: true,
      }),
    ).toBeVisible();
    await page.goto("/cards");
    await page
      .getByText("Cargar una colección o mazo inicial", { exact: true })
      .click();
    await page.getByLabel("Código de colección OPTCG").fill("OP97");
    await page
      .getByRole("button", { name: "Cargar colección", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "3 fichas" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const db = await connectLocalDatabase();
    try {
      const user = (
        await db.query("select id from auth.users where email=$1", [email])
      ).rows[0].id;
      const cards = (
        await db.query(
          "select card_number,printing_code,source from cards where user_id=$1 order by provider_card_id",
          [user],
        )
      ).rows;
      expect(cards).toHaveLength(3);
      expect(cards.every((c) => c.source === "optcgapi")).toBe(true);
      const entries = (
        await db.query(
          "select d.quantity,c.provider_card_id from deck_cards d join cards c on c.id=d.card_id where d.deck_version_id in (select id from deck_versions where user_id=$1) and d.role='main'",
          [user],
        )
      ).rows;
      expect(entries).toEqual([
        { quantity: 4, provider_card_id: "optcg_sets_OP97-010" },
      ]);
      const jobs = (
        await db.query(
          "select error_report from import_jobs where user_id=$1",
          [user],
        )
      ).rows;
      expect(
        jobs.some((j) =>
          j.error_report.some(
            (p: { code: string }) => p.code === "PROVIDER_NOTICE",
          ),
        ),
      ).toBe(true);
    } finally {
      await db.end();
    }
  } finally {
    const db = await connectLocalDatabase();
    try {
      await db.query("delete from auth.users where email=$1", [email]);
    } finally {
      await db.end();
    }
  }
});

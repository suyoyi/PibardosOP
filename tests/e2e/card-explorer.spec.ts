import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { connectLocalDatabase } from "../helpers/local-database";

test("mobile catalog loads without importing, filters all facts and opens exact-art details and prices", async ({
  page,
}) => {
  test.setTimeout(90000);
  const email = `explorer-e2e-${randomUUID()}@example.com`;
  try {
    await page.goto("/login");
    await page.getByRole("button", { name: "Crear mi primera cuenta" }).click();
    await page.getByLabel("Correo electrónico").fill(email);
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill(`Test-${randomUUID()}`);
    await page
      .getByRole("button", { name: "Crear cuenta", exact: true })
      .click();
    await expect(page).toHaveURL("/");
    await page.goto("/cards");
    const results = page.getByRole("list", { name: "Resultados del catálogo" });
    await expect(
      results.getByRole("button", { name: /^Ver carta / }),
    ).toHaveCount(3);
    await expect(
      page.getByRole("status").filter({ hasText: "3 cartas" }),
    ).toBeVisible();
    await expect(page.getByLabel("Counter", { exact: true })).toBeHidden();
    await page.getByLabel("Buscar carta", { exact: true }).fill("op97-10");
    await page
      .getByLabel("Expansión", { exact: true })
      .selectOption({ label: "Synthetic set · OP97" });
    await page.getByLabel("Color", { exact: true }).selectOption("red");
    await page.getByLabel("Coste", { exact: true }).selectOption("3");
    await expect(
      results.getByRole("button", { name: /^Ver carta / }),
    ).toHaveCount(1);
    await page
      .getByRole("button", { name: "Más filtros", exact: true })
      .click();
    await page.getByLabel("Counter", { exact: true }).selectOption("0");
    await page.getByLabel("Poder", { exact: true }).selectOption("5000");
    await page.getByLabel("Tipo", { exact: true }).selectOption("character");
    await page
      .getByLabel("Arquetipo / rasgos", { exact: true })
      .selectOption("Synthetic trait block");
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "1 impresiones coincidentes" }),
    ).toBeVisible();
    const tile = results.getByRole("button", { name: /^Ver carta OP97-010/ });
    await tile.click();
    const dialog = page.getByRole("dialog", { name: "Detalle de OP97-010" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", {
        name: "Synthetic OPTCG character parallel",
        exact: true,
      }),
    ).toBeVisible();
    await expect(dialog.getByText("0", { exact: true }).first()).toBeVisible();
    await expect(
      dialog.getByText(/Moneda no especificada por la API/),
    ).toBeVisible();
    await expect(
      dialog.getByText("Synthetic effect", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByText("Synthetic set · OP-97", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByText("Synthetic trait block", { exact: true }),
    ).toBeVisible();
    // The selected filter finds one printing, but the detail includes its other arts.
    await expect(
      dialog.getByRole("button", { name: /^Ver variante / }),
    ).toHaveCount(3);
    await dialog
      .getByRole("button", { name: "Ver variante OP97-010", exact: true })
      .click();
    await expect(
      dialog.getByRole("heading", {
        name: "Synthetic OPTCG character",
        exact: true,
      }),
    ).toBeVisible();
    await expect(dialog.getByText("2,5", { exact: true })).toBeVisible();
    const artwork = dialog
      .getByRole("img", {
        name: "Ilustración de Synthetic OPTCG character",
        exact: true,
      })
      .first();
    await expect
      .poll(() => artwork.evaluate((e) => (e as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await dialog
      .getByRole("button", { name: "Ver variante OP97-010_r1", exact: true })
      .click();
    await expect(dialog.getByText(/Sin precios disponibles/)).toBeVisible();
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 850 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
        true,
      );
    }
    await page.screenshot({ path: "/tmp/pibardos-catalog-fixture-detail.png" });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(tile).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
      "hidden",
    );
    await page
      .getByRole("button", { name: "Limpiar filtros", exact: true })
      .click();
    await page
      .getByLabel("Buscar carta", { exact: true })
      .fill("No existe esta carta");
    await expect(
      page.getByRole("heading", { name: "No hay cartas con estos filtros" }),
    ).toBeVisible();
    const db = await connectLocalDatabase();
    try {
      const user = (
        await db.query("select id from auth.users where email=$1", [email])
      ).rows[0].id;
      expect(
        (await db.query("select id from cards where user_id=$1", [user])).rows,
      ).toHaveLength(0);
      expect(
        (await db.query("select id from decks where user_id=$1", [user])).rows,
      ).toHaveLength(0);
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

import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { connectLocalDatabase } from "../helpers/local-database";
test("mobile manual catalog, unknown correction, confirmed import, editing and independent copies", async ({
  page,
}) => {
  test.setTimeout(90000);
  const email = `deck-e2e-${randomUUID()}@example.com`,
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
    for (const [code, name, type] of [
      ["OP98-001", "Synthetic mobile leader", "leader"],
      ["OP98-002", "Synthetic mobile character", "character"],
    ]) {
      await page.goto("/cards/new");
      await page.getByLabel("Código de carta").fill(code);
      await page.getByLabel("Nombre de carta").fill(name);
      await page.getByLabel("Tipo de carta").selectOption(type);
      await page.getByLabel("Rojo", { exact: true }).check();
      await page.getByRole("button", { name: "Guardar carta manual" }).click();
      await expect(page).toHaveURL(/\/cards\?saved=1/);
    }
    await page.goto("/decks/new");
    await page.getByLabel("Nombre del mazo").fill("Synthetic imported deck");
    await page
      .getByLabel("Líder del mazo")
      .selectOption({ label: "OP98-001 · Synthetic mobile leader" });
    await page
      .getByLabel("Lista de texto")
      .fill("1 OP98-001\n2 OP98-002\nOP98-002 x2\n4 OP98-999");
    await page.getByRole("button", { name: "Revisar importación" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "OP98-999 no está" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Guardar mazo", exact: true })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Confirma la revisión" }),
    ).toBeVisible();
    await expect(page.getByLabel("Nombre del mazo")).toHaveValue(
      "Synthetic imported deck",
    );
    await page
      .getByLabel("Lista de texto")
      .fill("1 OP98-001\n2 OP98-002\nOP98-002 x2");
    await page.getByRole("button", { name: "Revisar importación" }).click();
    await expect(page.getByText(/Duplicadas agrupadas:/)).toBeVisible();
    await page.getByLabel(/He revisado las cantidades/).check();
    await page
      .getByLabel("Nota de la versión")
      .fill("Synthetic initial import");
    await page
      .getByRole("button", { name: "Guardar mazo", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Synthetic imported deck",
        exact: true,
      }),
    ).toBeVisible();
    const deckUrl = new URL(page.url()).pathname;
    await expect(page.getByLabel("Lista exportada")).toHaveValue(/4 OP98-002/);
    await expect(
      page.getByRole("heading", { name: "Mazo principal: 4 / 50" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Editar mazo", exact: true }).click();
    await page.getByRole("button", { name: "Quitar una OP98-002" }).click();
    await page
      .getByLabel("Nota de la versión")
      .fill("Synthetic quantity change");
    await page
      .getByRole("button", { name: "Guardar mazo", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${deckUrl}\\?saved=1`));
    await page
      .getByRole("link", { name: "Comparar versiones", exact: true })
      .click();
    await expect(page.getByText("4 → 3 · Cantidad modificada")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.goto(deckUrl);
    await page
      .getByRole("button", { name: "Duplicar mazo", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Synthetic imported deck (copia)",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Versiones", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Versión 1 · actual" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: /Versión 2/ })).toHaveCount(
      0,
    );
    const db = await connectLocalDatabase();
    try {
      const user = (
        await db.query("select id from auth.users where email=$1", [email])
      ).rows[0];
      expect(
        (
          await db.query(
            "select version_number from deck_versions where user_id=$1 order by created_at",
            [user.id],
          )
        ).rows.map((v) => v.version_number),
      ).toEqual([1, 2, 1]);
      expect(
        (
          await db.query(
            "select status from import_jobs where user_id=$1 order by created_at",
            [user.id],
          )
        ).rows,
      ).toEqual([{ status: "preview" }, { status: "confirmed" }]);
      const firstPreview = (
        await db.query(
          "select raw_input,error_report from import_jobs where user_id=$1 order by created_at limit 1",
          [user.id],
        )
      ).rows[0];
      expect(firstPreview.raw_input).toContain("OP98-999");
      expect(firstPreview.error_report).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "UNKNOWN_CARD" }),
        ]),
      );
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

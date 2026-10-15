import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { compactDecklist } from "../fixtures/import-list";
import { connectLocalDatabase } from "../helpers/local-database";

test("compact sixteen-code import resolves an empty catalog in one review and uses the simplified card step", async ({
  page,
}) => {
  test.setTimeout(90000);
  const email = `compact-import-${randomUUID()}@example.com`;
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
    await page.goto("/decks/import");
    await page.getByLabel("Lista de texto").fill(compactDecklist);
    await page
      .getByRole("button", { name: "Revisar importación", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Vista previa · 16 cartas reconocidas",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByLabel("Lista de texto")).toHaveValue(
      compactDecklist,
    );
    await page.getByRole("button", { name: "Continuar con la lista" }).click();
    const header = page.getByRole("region", {
      name: "Líder del mazo seleccionado",
      exact: true,
    });
    await expect(
      header.getByRole("button", { name: "Cambiar líder", exact: true }),
    ).toBeVisible();
    await expect(
      header.getByRole("button", { name: "Continuar al nombre", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /Mazo principal:|Contenido del editor/,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /DON!!|carta manual/ }),
    ).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(
      "Solo cartas compatibles",
    );
    await expect(page.locator("body")).not.toContainText("cartas disponibles");
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await header
      .getByRole("button", { name: "Cambiar líder", exact: true })
      .click();
    await page.getByLabel("Buscar carta", { exact: true }).fill("OP09-062");
    await page
      .getByRole("button", { name: /^Ver variantes OP09-062 ·/ })
      .click();
    await page
      .getByRole("dialog", { name: "Variantes de OP09-062", exact: true })
      .getByRole("button", {
        name: "Elegir líder OP09-062 · Synthetic compact import 0",
        exact: true,
      })
      .click();
    await expect(
      page.getByLabel("Contador del mazo: 50 de 50 cartas", { exact: true }),
    ).toBeVisible();
    await header
      .getByRole("button", { name: "Cambiar líder", exact: true })
      .click();
    await page.getByLabel("Buscar carta", { exact: true }).fill("OP97-002");
    await page
      .getByRole("button", { name: /^Ver variantes OP97-002 ·/ })
      .click();
    await page
      .getByRole("dialog", { name: "Variantes de OP97-002", exact: true })
      .getByRole("button", {
        name: "Elegir líder OP97-002 · Synthetic blue change leader",
        exact: true,
      })
      .click();
    await page.getByLabel("Buscar carta", { exact: true }).fill("ST34-003");
    await page
      .getByRole("button", { name: /^Ver variantes ST34-003 ·/ })
      .click();
    const selected = page.getByRole("dialog", {
      name: "Variantes de ST34-003",
      exact: true,
    });
    await selected
      .getByRole("button", {
        name: "Quitar ST34-003 · Synthetic compact import 2",
        exact: true,
      })
      .click();
    await expect(
      selected.getByRole("button", {
        name: "Añadir ST34-003 · Synthetic compact import 2",
        exact: true,
      }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(
      page.getByLabel("Contador del mazo: 49 de 50 cartas", { exact: true }),
    ).toBeVisible();
    await header
      .getByRole("button", { name: "Cambiar líder", exact: true })
      .click();
    await page.getByLabel("Buscar carta", { exact: true }).fill("OP09-062");
    await page
      .getByRole("button", { name: /^Ver variantes OP09-062 ·/ })
      .click();
    await page
      .getByRole("dialog", { name: "Variantes de OP09-062", exact: true })
      .getByRole("button", {
        name: "Elegir líder OP09-062 · Synthetic compact import 0",
        exact: true,
      })
      .click();
    await page.getByLabel("Buscar carta", { exact: true }).fill("ST34-003");
    await page
      .getByRole("button", { name: /^Ver variantes ST34-003 ·/ })
      .click();
    await selected
      .getByRole("button", {
        name: "Añadir ST34-003 · Synthetic compact import 2",
        exact: true,
      })
      .click();
    await page.keyboard.press("Escape");
    await page.getByLabel("Buscar carta", { exact: true }).fill("");
    await expect(
      page.getByLabel("Contador del mazo: 50 de 50 cartas", { exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "/tmp/pibardos-simplified-builder-synthetic.png",
      fullPage: true,
    });
    await header
      .getByRole("button", { name: "Continuar al nombre", exact: true })
      .click();
    await page
      .getByLabel("Nombre del mazo")
      .fill("Synthetic compact full deck");
    await page.getByLabel(/He revisado las cantidades/).check();
    await page
      .getByRole("button", { name: "Guardar mazo", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Synthetic compact full deck",
        exact: true,
      }),
    ).toBeVisible();
    const db = await connectLocalDatabase();
    try {
      const rows = (
        await db.query(
          "select c.quantity from deck_cards c join decks d on d.current_version_id=c.deck_version_id where d.user_id=(select id from auth.users where email=$1)",
          [email],
        )
      ).rows;
      expect(rows.reduce((sum, r) => sum + r.quantity, 0)).toBe(50);
      expect(rows).toHaveLength(15);
      expect(
        (
          await db.query(
            "select status from import_jobs where user_id=(select id from auth.users where email=$1)",
            [email],
          )
        ).rows,
      ).toEqual([{ status: "confirmed" }]);
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

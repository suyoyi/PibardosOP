import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { connectLocalDatabase } from "../helpers/local-database";

test("mobile catalog loads without importing, filters all facts and opens exact-art details and prices", async ({
  page,
}) => {
  test.setTimeout(90000);
  const email = `explorer-e2e-${randomUUID()}@example.com`;
  const historyRequests: string[] = [];
  page.on("request", (request) => {
    const body = request.postData() ?? "";
    if (
      request.headers()["next-action"] &&
      body.includes("external_id") &&
      body.includes("card_number")
    )
      historyRequests.push(body);
  });
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
    await expect(
      page.getByText("Importación avanzada", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText(/Catálogo parcial o con avisos/)).toHaveCount(
      0,
    );
    await expect(
      page.locator('a[href^="/collection"], a[href^="/wishlist"]'),
    ).toHaveCount(0);
    const results = page.getByRole("list", { name: "Resultados del catálogo" });
    await expect(
      results.getByRole("button", { name: /^Ver carta / }),
    ).toHaveCount(5);
    await expect(
      page.getByRole("status").filter({ hasText: "5 cartas" }),
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
      dialog.getByText("Colección y deseos", { exact: true }),
    ).toHaveCount(0);
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
    const history = dialog.getByRole("region", {
      name: "Histórico de precios",
      exact: true,
    });
    await expect(history.getByText(/Sin fechas individuales/)).toBeVisible();
    await expect(history.locator("svg.recharts-surface")).toBeVisible();
    await expect(history.locator("svg.recharts-surface")).not.toHaveAttribute(
      "tabindex",
      "0",
    );
    await history
      .getByText("Ver valores del histórico", { exact: true })
      .click();
    await expect(
      history.getByRole("row", { name: "Day1 0 2,1", exact: true }),
    ).toBeVisible();
    await expect(
      history.getByRole("row", { name: "Day2 Sin dato Sin dato", exact: true }),
    ).toBeVisible();
    await expect(history.getByRole("row")).toHaveCount(15);
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
    await expect(history.getByText(/Sin fechas individuales/)).toBeVisible();
    await history
      .getByText("Ver valores del histórico", { exact: true })
      .click();
    await expect(
      history.getByRole("row", { name: "Day1 1,1 2,1", exact: true }),
    ).toBeVisible();
    // Reopening a previously selected artwork reuses its mounted-dialog request.
    const previousRequests = historyRequests.filter((body) =>
      body.includes("optcg_sets_OP97-010_p1"),
    ).length;
    expect(previousRequests).toBe(1);
    await dialog
      .getByRole("button", { name: "Ver variante OP97-010_p1", exact: true })
      .click();
    await expect(history.getByText(/Sin fechas individuales/)).toBeVisible();
    expect(
      historyRequests.filter((body) => body.includes("optcg_sets_OP97-010_p1")),
    ).toHaveLength(previousRequests);

    await dialog
      .getByRole("button", { name: "Ver variante OP97-010", exact: true })
      .click();
    await expect(history.getByText(/Sin fechas individuales/)).toBeVisible();
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
    await expect(
      history.getByText(/todavía no ofrece un histórico documentado/),
    ).toBeVisible();
    await expect(history.locator("svg.recharts-surface")).toHaveCount(0);

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
    await page.getByLabel("Buscar carta", { exact: true }).fill("OP97-011");
    await results.getByRole("button", { name: /^Ver carta OP97-011/ }).click();
    const failed = page.getByRole("dialog", { name: "Detalle de OP97-011" });
    const failedHistory = failed.getByRole("region", {
      name: "Histórico de precios",
      exact: true,
    });
    await expect(failedHistory.getByRole("alert")).toContainText(
      "no está disponible ahora mismo",
    );
    await expect(failed.getByText("2,5", { exact: true })).toBeVisible();
    await expect(failedHistory.locator("svg.recharts-surface")).toHaveCount(0);
    await failedHistory
      .getByRole("button", { name: "Reintentar histórico" })
      .click();
    await expect(failedHistory.getByRole("alert")).toBeVisible();
    await page.keyboard.press("Escape");
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

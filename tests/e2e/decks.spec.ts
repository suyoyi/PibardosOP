import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { connectLocalDatabase } from "../helpers/local-database";
test("separate deck creation/import, simple header, plain clipboard export and confirmed deletion preserve recorded games", async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  const email = `deck-e2e-${randomUUID()}@example.com`,
    password = `Test-${randomUUID()}`;
  let owner = "",
    deckId = "",
    leaderId = "";
  try {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: "http://127.0.0.1:3100",
    });
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
    await page.goto("/decks");
    await expect(
      page.getByRole("link", { name: "Importar mazo", exact: true }),
    ).toHaveAttribute("href", "/decks/import");
    await expect(
      page.getByRole("link", { name: "Historial de importaciones" }),
    ).toHaveCount(0);
    await page.getByRole("link", { name: "Crear mazo", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Crear mazo", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Lista de texto", { exact: true }),
    ).toHaveCount(0);
    await page.goto("/decks/import");
    await expect(
      page.getByRole("heading", { name: "Importar mazo", exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Lista de texto")
      .fill("1 OP98-001\n2 OP98-002\nOP98-002 x2\n4 OP98-999");
    await page.getByRole("button", { name: "Revisar importación" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "OP98-999 no está" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continuar con la lista" }),
    ).toBeDisabled();
    await expect(page.getByLabel("Lista de texto")).toHaveValue(/OP98-999/);
    await page
      .getByLabel("Lista de texto")
      .fill("1 OP98-001\n2 OP98-002\nOP98-002 x2");
    await page.getByRole("button", { name: "Revisar importación" }).click();
    await expect(page.getByText(/Duplicadas agrupadas:/)).toBeVisible();
    await page.getByRole("button", { name: "Continuar con la lista" }).click();
    await expect(
      page.getByRole("heading", { name: "Mazo principal: 4 / 50" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continuar al nombre" }).click();
    await page.getByLabel("Nombre del mazo").fill("Synthetic imported deck");
    await expect(page.getByLabel("Estado", { exact: true })).toHaveCount(0);
    await page.getByLabel(/He revisado las cantidades/).check();
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
    deckId = deckUrl.split("/").at(-1)!;
    const header = page.getByRole("region", {
      name: "Cabecera del mazo",
      exact: true,
    });
    await expect(
      header.getByRole("link", { name: "Editar mazo" }),
    ).toBeVisible();
    await expect(
      header.getByRole("button", { name: "Eliminar mazo" }),
    ).toBeVisible();
    for (const label of ["Duplicar mazo", "Archivar mazo"])
      await expect(page.getByRole("button", { name: label })).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Validación del mazo" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Versiones", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Comparar versiones", exact: true }),
    ).toHaveCount(0);
    await header
      .getByRole("button", { name: "Exportar lista", exact: true })
      .click();
    const exported = page.getByRole("dialog", {
      name: "Exportar lista",
      exact: true,
    });
    await expect(exported.getByLabel("Lista exportada")).toHaveValue(
      "1 OP98-001\n4 OP98-002",
    );
    await exported.getByRole("button", { name: "Copiar", exact: true }).click();
    await expect(exported.getByRole("status")).toContainText(
      "Lista copiada al portapapeles",
    );
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "1 OP98-001\n4 OP98-002",
    );
    await page.keyboard.press("Escape");
    await expect(
      header.getByRole("button", { name: "Exportar lista", exact: true }),
    ).toBeFocused();
    await page.getByRole("link", { name: "Editar mazo", exact: true }).click();
    await page.getByRole("button", { name: "Quitar una OP98-002" }).click();
    await page
      .getByRole("button", { name: "Guardar mazo", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${deckUrl}\\?saved=1`));
    await header
      .getByRole("button", { name: "Exportar lista", exact: true })
      .click();
    await expect(exported.getByLabel("Lista exportada")).toHaveValue(
      "1 OP98-001\n3 OP98-002",
    );
    await page.keyboard.press("Escape");
    const db = await connectLocalDatabase();
    try {
      owner = (
        await db.query("select id from auth.users where email=$1", [email])
      ).rows[0].id;
      const snapshots = (
        await db.query(
          "select v.version_number,c.quantity from deck_versions v join deck_cards c on c.deck_version_id=v.id where v.deck_id=$1 order by v.version_number",
          [deckId],
        )
      ).rows;
      expect(snapshots).toEqual([
        { version_number: 1, quantity: 4 },
        { version_number: 2, quantity: 3 },
      ]);
      expect(
        (
          await db.query(
            "select status from import_jobs where user_id=$1 order by created_at",
            [owner],
          )
        ).rows,
      ).toEqual([{ status: "preview" }, { status: "confirmed" }]);
      const preview = (
        await db.query(
          "select raw_input,error_report from import_jobs where user_id=$1 order by created_at limit 1",
          [owner],
        )
      ).rows[0];
      expect(preview.raw_input).toContain("OP98-999");
      expect(preview.error_report).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "UNKNOWN_CARD" }),
        ]),
      );
      leaderId = (
        await db.query("select leader_card_id from decks where id=$1", [deckId])
      ).rows[0].leader_card_id;
      await db.query(
        "insert into matches(user_id,deck_version_id,opponent_leader_id,result,went_first,format,match_type) select user_id,current_version_id,leader_card_id,'win',true,'standard','friendly' from decks where id=$1",
        [deckId],
      );
    } finally {
      await db.end();
    }
    page.once("dialog", (d) => d.accept());
    await header
      .getByRole("button", { name: "Eliminar mazo", exact: true })
      .click();
    await expect(header.getByRole("alert")).toContainText(
      "hay partidas o torneos vinculados",
    );
    await expect(
      page.getByRole("heading", {
        name: "Synthetic imported deck",
        exact: true,
      }),
    ).toBeVisible();
    const clear = await connectLocalDatabase();
    try {
      expect(
        (await clear.query("select id from matches where user_id=$1", [owner]))
          .rows,
      ).toHaveLength(1);
      await clear.query("delete from matches where user_id=$1", [owner]);
    } finally {
      await clear.end();
    }
    await page.goto("/decks");
    await expect(
      page.getByRole("button", { name: "Ver lista", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Estado del mazo", { exact: true }),
    ).toHaveCount(0);
    const tile = page
      .getByRole("list", { name: "Mis mazos" })
      .getByRole("link", { name: /Synthetic imported deck/ });
    await expect(tile).toBeVisible();
    expect(
      await tile
        .getByLabel("Sin ilustración de Synthetic mobile leader")
        .evaluate((e) => e.getBoundingClientRect().height),
    ).toBeGreaterThan(176);
    await tile.click();
    for (const path of ["versions", "compare"]) {
      await page.goto(`${deckUrl}/${path}`);
      await expect(page).toHaveURL(deckUrl);
    }
    await page.goto("/decks/imports");
    await expect(page).toHaveURL("/decks/import");
    await page.goto(deckUrl);
    page.once("dialog", (d) => d.dismiss());
    await header
      .getByRole("button", { name: "Eliminar mazo", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Synthetic imported deck",
        exact: true,
      }),
    ).toBeVisible();
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.screenshot({
      path: "/tmp/pibardos-simple-deck-synthetic.png",
      fullPage: true,
    });
    page.once("dialog", (d) => d.accept());
    await header
      .getByRole("button", { name: "Eliminar mazo", exact: true })
      .click();
    await expect(page).toHaveURL(/\/decks\?saved=1/);
    await expect(
      page.getByRole("heading", { name: "Una biblioteca por construir" }),
    ).toBeVisible();
    const verify = await connectLocalDatabase();
    try {
      expect(
        (
          await verify.query("select id from deck_versions where deck_id=$1", [
            deckId,
          ])
        ).rows,
      ).toEqual([]);
      expect(
        (await verify.query("select id from cards where id=$1", [leaderId]))
          .rows,
      ).toHaveLength(1);
    } finally {
      await verify.end();
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

import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { connectLocalDatabase } from "../helpers/local-database";
test("mobile empty-catalog deck builder searches automatically, selects leader and cards without import, and preserves drafts on errors", async ({
  page,
}) => {
  test.setTimeout(90000);
  const email = `builder-search-${randomUUID()}@example.com`,
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
    await page.goto("/decks/new");
    await page.getByLabel("Nombre del mazo").fill("Direct builder draft");
    await page
      .getByLabel("Descripción", { exact: true })
      .fill("Keep these unsaved notes");
    const search = page.getByRole("region", {
      name: "Buscar cartas para el mazo",
    });
    await search.getByLabel("Buscar carta").fill("OP97-001");
    const chooseLeader = search.getByRole("button", {
      name: "Elegir líder OP97-001 · Synthetic OPTCG leader",
      exact: true,
    });
    await expect(chooseLeader).toBeVisible();
    // A search must not turn all its results into the user's private collection.
    let db = await connectLocalDatabase();
    try {
      expect(
        (
          await db.query(
            "select id from cards where user_id=(select id from auth.users where email=$1)",
            [email],
          )
        ).rows,
      ).toHaveLength(0);
    } finally {
      await db.end();
    }
    await chooseLeader.click();
    await expect(page.getByLabel("Líder del mazo")).not.toHaveValue("");
    await expect(page).toHaveURL(/\/decks\/new$/);
    await search.getByLabel("Buscar carta").fill("OP97-010");
    await expect(
      search.getByRole("button", {
        name: "Añadir OP97-010 · Synthetic OPTCG character parallel",
        exact: true,
      }),
    ).toBeVisible();
    await search.getByLabel("Coste", { exact: true }).selectOption("3");
    await search.getByLabel("Color", { exact: true }).selectOption("blue");
    await expect(
      search.getByRole("button", {
        name: "Añadir OP97-010 · Synthetic OPTCG character",
        exact: true,
      }),
    ).toHaveCount(0);
    await search.getByLabel("Color", { exact: true }).selectOption("red");
    const add = search.getByRole("button", {
      name: "Añadir OP97-010 · Synthetic OPTCG character",
      exact: true,
    });
    await add.click();
    await expect(
      page.getByRole("heading", { name: "Mazo principal: 1 / 50" }),
    ).toBeVisible();
    await expect(add).toBeEnabled();
    await add.click();
    await expect(
      page.getByRole("heading", { name: "Mazo principal: 2 / 50" }),
    ).toBeVisible();
    await search.getByLabel("Coste", { exact: true }).selectOption("");
    await search.getByLabel("Color", { exact: true }).selectOption("");
    // A slow superseded search cannot replace the newer leader query.
    await search.getByLabel("Buscar carta").fill("delayed");
    await expect(
      search.getByRole("status").filter({ hasText: "Buscando cartas" }),
    ).toBeVisible();
    await page.waitForTimeout(650);
    await search.getByLabel("Buscar carta").fill("OP97-001");
    await expect(chooseLeader).toBeVisible();
    await expect(
      search.getByRole("button", {
        name: "Añadir OP97-010 · Synthetic OPTCG character",
        exact: true,
      }),
    ).toHaveCount(0);
    await search.getByLabel("Buscar carta").fill("Unavailable");
    const unavailable = search.getByRole("button", {
      name: "Añadir OP97-066 · Synthetic unavailable card",
      exact: true,
    });
    await expect(unavailable).toBeVisible();
    await unavailable.click();
    await expect(
      search.getByRole("alert").filter({ hasText: "no está disponible" }),
    ).toBeVisible();
    await search.getByLabel("Buscar carta").fill("OP97-010");
    await search.getByLabel("Grupo del proveedor").selectOption("promos");
    await expect(
      search.getByRole("alert").filter({ hasText: "no está disponible" }),
    ).toBeVisible();
    await expect(add).toBeVisible();
    await expect(page.getByLabel("Nombre del mazo")).toHaveValue(
      "Direct builder draft",
    );
    await expect(page.getByLabel("Descripción", { exact: true })).toHaveValue(
      "Keep these unsaved notes",
    );
    await expect(page.getByLabel("Cantidad OP97-010")).toHaveValue("2");
    db = await connectLocalDatabase();
    try {
      expect(
        (
          await db.query(
            "select id from decks where user_id=(select id from auth.users where email=$1)",
            [email],
          )
        ).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query(
            "select id from cards where user_id=(select id from auth.users where email=$1)",
            [email],
          )
        ).rows,
      ).toHaveLength(2);
    } finally {
      await db.end();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Guardar mazo", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Direct builder draft", exact: true }),
    ).toBeVisible();
    db = await connectLocalDatabase();
    try {
      const entries = (
        await db.query(
          "select c.provider_card_id,d.quantity from deck_cards d join cards c on c.id=d.card_id where d.deck_version_id in (select id from deck_versions where user_id=(select id from auth.users where email=$1)) and role='main'",
          [email],
        )
      ).rows;
      expect(entries).toEqual([
        { provider_card_id: "optcg_sets_OP97-010", quantity: 2 },
      ]);
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

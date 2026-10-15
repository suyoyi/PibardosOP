import { collectionEnabled } from "../../src/lib/features";
import { test, expect, type Page, type Locator } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { connectLocalDatabase } from "../helpers/local-database";
import { normalizeOptcgCard } from "../../src/domain/optcg";
import { optcgRecord } from "../fixtures/optcg";
async function openControls(scope: Page | Locator) {
  await scope.getByText("Colección y deseos", { exact: true }).click();
  await expect(
    scope.getByRole("form", { name: "Objetivo de la lista de deseos" }),
  ).toBeVisible();
}
async function addLot(
  scope: Page | Locator,
  owned: number,
  tradeable: number,
  location: string,
) {
  await scope.getByText("Añadir lote en inglés", { exact: true }).click();
  const form = scope.getByRole("form", { name: "Nuevo lote", exact: true });
  await form.getByLabel("Copias que tengo").fill(String(owned));
  await form.getByLabel("Para intercambio").fill(String(tradeable));
  await form.getByLabel("Ubicación").fill(location);
  await form.getByRole("button", { name: "Guardar lote", exact: true }).click();
  await expect(
    scope.getByRole("status").filter({ hasText: "Colección actualizada." }),
  ).toBeVisible();
}
test("physical collection, exact-art wishes and missing cards reserve copies once across decks", async ({
  page,
  browser,
}) => {
  test.skip(
    !collectionEnabled,
    "Collection and wishlist UI are intentionally hidden pending redesign; database/domain coverage remains active.",
  );
  test.setTimeout(180000);
  const email = `collection-${randomUUID()}@example.com`,
    deckA = randomUUID(),
    deckB = randomUUID();
  let owner = "",
    baseId = "",
    altId = "";
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
    await page.goto("/collection");
    await expect(
      page.getByText("Todavía no has registrado copias físicas", {
        exact: true,
      }),
    ).toBeVisible();
    await page.goto("/wishlist");
    await expect(
      page.getByText("Tu lista de deseos está vacía", { exact: true }),
    ).toBeVisible();
    await page.goto("/cards");
    await page.getByLabel("Buscar carta", { exact: true }).fill("OP97-010");
    await page
      .getByRole("list", { name: "Resultados del catálogo" })
      .getByRole("button", { name: /^Ver carta OP97-010 / })
      .click();
    const dialog = page.getByRole("dialog", { name: "Detalle de OP97-010" });
    await openControls(dialog);
    const before = await connectLocalDatabase();
    try {
      owner = (
        await before.query("select id from auth.users where email=$1", [email])
      ).rows[0].id;
      for (const table of ["cards", "collection_items", "wishlist_items"])
        expect(
          (
            await before.query(`select id from ${table} where user_id=$1`, [
              owner,
            ])
          ).rowCount,
        ).toBe(0);
    } finally {
      await before.end();
    }
    await dialog
      .getByRole("button", { name: "Ver variante OP97-010_p1", exact: true })
      .click();
    await openControls(dialog);
    const wish = dialog.getByRole("form", {
      name: "Objetivo de la lista de deseos",
    });
    await wish
      .getByLabel("Objetivo total de esta impresión", { exact: true })
      .fill("2");
    await wish.getByLabel("Prioridad", { exact: true }).selectOption("high");
    await wish.getByLabel("Notas del deseo").fill("Only this parallel artwork");
    await wish
      .getByRole("button", { name: "Guardar deseo", exact: true })
      .click();
    await expect(
      dialog
        .getByRole("status")
        .filter({ hasText: "Lista de deseos actualizada." }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page.goto("/wishlist");
    let altRow = page.getByRole("listitem", {
      name: "Impresión OP97-010 OP97-010_p1",
      exact: true,
    });
    await expect(altRow).toContainText("Faltan 2");
    await expect(altRow).toContainText("Prioridad Alta");
    await openControls(altRow);
    await addLot(altRow, 1, 0, "Box parallel");
    await expect(altRow).toContainText("Faltan 1");
    const db = await connectLocalDatabase();
    try {
      altId = (
        await db.query(
          "select id from cards where user_id=$1 and provider_card_id='optcg_sets_OP97-010_p1'",
          [owner],
        )
      ).rows[0].id;
      expect(
        (
          await db.query(
            "select quantity_owned from collection_items where user_id=$1",
            [owner],
          )
        ).rows,
      ).toEqual([{ quantity_owned: 1 }]);
    } finally {
      await db.end();
    }
    await page.goto("/cards");
    await page.getByLabel("Buscar carta", { exact: true }).fill("OP97-010");
    await page
      .getByRole("list", { name: "Resultados del catálogo" })
      .getByRole("button", { name: /^Ver carta OP97-010 / })
      .click();
    await openControls(dialog);
    await addLot(dialog, 3, 1, "Box base");
    await page.keyboard.press("Escape");
    const setup = await connectLocalDatabase();
    try {
      await setup.query("begin");
      await setup.query("select set_config('request.jwt.claim.sub',$1,true)", [
        owner,
      ]);
      await setup.query("set local role authenticated");
      baseId = (
        await setup.query(
          "select id from cards where provider_card_id='optcg_sets_OP97-010'",
        )
      ).rows[0].id;
      const leader = (
        await setup.query("select cache_optcg_card($1) as id", [
          normalizeOptcgCard(
            optcgRecord({
              card_set_id: "OP97-001",
              card_image_id: "OP97-001",
              card_name: "Synthetic OPTCG leader",
              card_type: "Leader",
              life: 5,
              card_image:
                "https://optcgapi.com/media/static/Card_Images/OP97-001.jpg",
            }),
            "sets",
          ),
        ])
      ).rows[0].id;
      for (const [id, name] of [
        [deckA, "Physical Alpha"],
        [deckB, "Physical Beta"],
      ])
        await setup.query("select save_deck($1)", [
          {
            id,
            expected_version_id: "",
            name,
            leader_card_id: leader,
            format: "standard",
            status: "draft",
            cards: [{ card_id: baseId, quantity: 4, role: "main" }],
          },
        ]);
      await setup.query("commit");
    } finally {
      await setup.end();
    }
    await page.goto(`/collection?deck=${deckA}`);
    const need = page.getByRole("listitem", {
      name: "Necesidades OP97-010",
      exact: true,
    });
    await expect(need).toContainText("Faltan 1");
    await expect(
      page.getByRole("listitem", { name: "Necesidades OP97-001", exact: true }),
    ).toContainText("Faltan 1");
    await page
      .getByRole("button", { name: "Reservar copias disponibles", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Reservas ajustadas" }),
    ).toBeVisible();
    await expect(need).toContainText("Reservadas 3");
    await page.getByLabel("Mazo físico", { exact: true }).selectOption(deckB);
    await expect(need).toContainText("Faltan 4");
    await page
      .getByRole("button", {
        name: "Añadir faltantes OP97-010 a deseos",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Faltantes añadidas" }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: "Añadir faltantes OP97-010 a deseos",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Faltantes añadidas" }),
    ).toBeVisible();
    const baseRow = page.getByRole("listitem", {
      name: "Impresión OP97-010 OP97-010",
      exact: true,
    });
    await openControls(baseRow);
    const edit = baseRow.getByRole("form", {
      name: "Editar lote Box base",
      exact: true,
    });
    await edit.getByLabel("Copias que tengo").fill("1");
    await edit.getByLabel("Para intercambio").fill("0");
    await edit
      .getByRole("button", { name: "Guardar cambios del lote", exact: true })
      .click();
    await expect(baseRow.getByRole("alert")).toContainText(
      "Libera primero las reservas",
    );
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 850 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    await page.getByLabel("Mazo físico", { exact: true }).selectOption(deckA);
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", { name: "Liberar reservas del mazo", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Reservas liberadas" }),
    ).toBeVisible();
    await expect(need).toContainText("Reservadas 0");
    await page.goto("/wishlist");
    altRow = page.getByRole("listitem", {
      name: "Impresión OP97-010 OP97-010_p1",
      exact: true,
    });
    await expect(altRow).toContainText("Faltan 1");
    await expect(altRow).toContainText("Only this parallel artwork");
    await openControls(altRow);
    const altEdit = altRow.getByRole("form", {
      name: "Editar lote Box parallel",
      exact: true,
    });
    await altEdit.getByLabel("Copias que tengo").fill("2");
    await altEdit
      .getByRole("button", { name: "Guardar cambios del lote", exact: true })
      .click();
    await expect(altRow).toContainText("Objetivo completado");
    await page.screenshot({ path: "/tmp/pibardos-wishlist-synthetic.png" });
    page.once("dialog", (d) => d.accept());
    await altRow
      .getByRole("button", { name: "Quitar de deseos", exact: true })
      .click();
    await expect(altRow).toHaveCount(0);
    const verify = await connectLocalDatabase();
    try {
      expect(
        (
          await verify.query(
            "select quantity_owned,quantity_tradeable from collection_items where user_id=$1 order by storage_location",
            [owner],
          )
        ).rows,
      ).toEqual([
        { quantity_owned: 3, quantity_tradeable: 1 },
        { quantity_owned: 2, quantity_tradeable: 0 },
      ]);
      expect(
        (
          await verify.query(
            "select card_id,target_quantity from wishlist_items where user_id=$1",
            [owner],
          )
        ).rows,
      ).toEqual([{ card_id: baseId, target_quantity: 7 }]);
      expect(
        (
          await verify.query(
            "select id from collection_allocations where user_id=$1",
            [owner],
          )
        ).rows,
      ).toEqual([]);
      expect(
        (
          await verify.query(
            "select card_id from collection_items where user_id=$1 and card_id=$2",
            [owner, altId],
          )
        ).rowCount,
      ).toBe(1);
    } finally {
      await verify.end();
    }
    const anon = await browser.newContext();
    try {
      const p = await anon.newPage();
      for (const path of ["/collection", "/wishlist"]) {
        await p.goto(`http://127.0.0.1:3100${path}`);
        await expect(p).toHaveURL(/\/login/);
      }
    } finally {
      await anon.close();
    }
  } finally {
    const cleanup = await connectLocalDatabase();
    try {
      await cleanup.query("delete from auth.users where email=$1", [email]);
    } finally {
      await cleanup.end();
    }
  }
});

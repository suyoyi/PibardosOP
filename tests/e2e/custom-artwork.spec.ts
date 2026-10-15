import { test, expect } from "@playwright/test";
import { randomUUID, createHash } from "node:crypto";
import { customArtworks } from "../../src/domain/custom-artworks";
import { connectLocalDatabase } from "../helpers/local-database";

test("Roronoa Vinny is a canonical leader variant with original artwork in catalog, decks, home and exact-version games", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(10000);
  const art = customArtworks[0],
    email = `vinny-${randomUUID()}@example.com`,
    imagePath = `/api/custom-artworks/${art.id}/image`;
  expect((await request.get(imagePath)).status()).toBe(401);
  expect(
    (await request.get("/api/custom-artworks/not-registered/image")).status(),
  ).toBe(404);
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
    const response = await page.request.get(imagePath);
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe("private, no-store");
    expect(response.headers()["content-type"]).toBe("image/png");
    expect(
      createHash("sha256")
        .update(await response.body())
        .digest("hex"),
    ).toBe("9bbc59e00229acbaa0d6f898e50c0f4e608550380b393900efa9be1ecbddeefd");
    await page.goto("/cards");
    await page.getByLabel("Buscar carta", { exact: true }).fill("Vinny");
    await page
      .getByRole("button", {
        name: "Ver carta OP12-020 · Roronoa Vinny",
        exact: true,
      })
      .click();
    const detail = page.getByRole("dialog", {
      name: "Detalle de OP12-020",
      exact: true,
    });
    await expect(
      detail.getByRole("heading", { name: art.name, exact: true }),
    ).toBeVisible();
    await expect(detail).toContainText("Arte personalizado");
    await expect(detail).toContainText("no tiene precio de mercado propio");
    await expect(
      detail.getByRole("region", { name: "Histórico de precios", exact: true }),
    ).toHaveCount(0);
    const artImage = detail
      .getByRole("img", { name: `Ilustración de ${art.name}`, exact: true })
      .first();
    await expect(artImage).toHaveAttribute(
      "src",
      new URL(imagePath, page.url()).href,
    );
    await expect
      .poll(() =>
        artImage.evaluate((e) => (e as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(500);
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    await page.goto("/decks/new");
    await page.getByLabel("Buscar carta", { exact: true }).fill("OP12-20");
    await page
      .getByRole("button", { name: /^Ver variantes OP12-020 ·/ })
      .click();
    const variants = page.getByRole("dialog", {
      name: "Variantes de OP12-020",
      exact: true,
    });
    await variants
      .getByRole("button", {
        name: "Elegir líder OP12-020 · Roronoa Vinny",
        exact: true,
      })
      .click();
    const context = page.getByRole("region", {
      name: "Líder del mazo seleccionado",
      exact: true,
    });
    await expect(context).toContainText(art.name);
    await context
      .getByRole("button", {
        name: `Ampliar líder OP12-020 · ${art.name}`,
        exact: true,
      })
      .click();
    await expect(
      page
        .getByRole("dialog", {
          name: "Líder seleccionado · OP12-020",
          exact: true,
        })
        .getByRole("img"),
    ).toHaveAttribute("src", new URL(imagePath, page.url()).href);
    await page.keyboard.press("Escape");
    await context
      .getByRole("button", { name: "Continuar al nombre", exact: true })
      .click();
    await page.getByLabel("Nombre del mazo").fill("Vinny custom deck");
    await page
      .getByRole("button", { name: "Guardar mazo", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Vinny custom deck", exact: true }),
    ).toBeVisible();
    const deckId = new URL(page.url()).pathname.split("/").at(-1)!;
    const header = page.getByRole("region", {
      name: "Cabecera del mazo",
      exact: true,
    });
    await expect(header).toContainText(art.name);
    await expect(header.getByRole("img")).toHaveAttribute(
      "src",
      new URL(imagePath, page.url()).href,
    );
    await expect(
      header.getByRole("region", { name: "Precio mazo", exact: true }),
    ).toContainText("No disponible");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "/tmp/pibardos-vinny-deck.png",
      fullPage: true,
    });
    await header
      .getByRole("button", { name: "Exportar lista", exact: true })
      .click();
    await expect(
      page
        .getByRole("dialog", { name: "Exportar lista", exact: true })
        .getByLabel("Lista exportada"),
    ).toHaveValue("1 OP12-020");
    await page.keyboard.press("Escape");
    await header
      .getByRole("link", { name: "Editar mazo", exact: true })
      .click();
    await page.getByLabel("Nombre del mazo").fill("Vinny custom renamed");
    await page
      .getByRole("button", { name: "Guardar mazo", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Vinny custom renamed", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Registrar partida", exact: true })
      .click();
    await expect(
      page
        .getByRole("region", {
          name: "Tu líder en la versión jugada",
          exact: true,
        })
        .getByRole("img"),
    ).toHaveAttribute("src", new URL(imagePath, page.url()).href);
    await page
      .getByRole("button", { name: "Elegir líder rival", exact: true })
      .click();
    await page
      .getByLabel("Buscar líder rival", { exact: true })
      .fill("OP12-020");
    const rivals = page.getByRole("dialog", {
      name: "Elegir líder rival",
      exact: true,
    });
    await expect(
      rivals
        .getByRole("list", { name: "Líderes rivales disponibles" })
        .getByRole("button"),
    ).toHaveCount(1);
    await rivals
      .getByRole("button", {
        name: "Elegir rival OP12-020 · Roronoa Zoro (020)",
        exact: true,
      })
      .click();
    await page.getByLabel("Victoria", { exact: true }).check();
    await page.getByLabel("Primero", { exact: true }).check();
    await page
      .getByRole("button", { name: "Guardar partida", exact: true })
      .click();
    await expect(page).toHaveURL(/\/matches\?saved=1/);
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: /Ver líder .*Roronoa Vinny/ }),
    ).toBeVisible();
    const db = await connectLocalDatabase();
    try {
      const versions = (
        await db.query(
          "select v.leader_card_id from deck_versions v where v.deck_id=$1",
          [deckId],
        )
      ).rows;
      expect(versions).toEqual([{ leader_card_id: art.cardId }]);
      expect(
        (
          await db.query(
            "select m.result,m.went_first,v.leader_card_id from matches m join deck_versions v on v.id=m.deck_version_id where v.deck_id=$1",
            [deckId],
          )
        ).rows,
      ).toEqual([
        { result: "win", went_first: true, leader_card_id: art.cardId },
      ]);
    } finally {
      await db.end();
    }
  } finally {
    const db = await connectLocalDatabase();
    try {
      await db.query("delete from auth.users where email=$1", [email]);
      expect(
        (await db.query("select id from cards where id=$1", [art.cardId])).rows,
      ).toHaveLength(1);
    } finally {
      await db.end();
    }
  }
});

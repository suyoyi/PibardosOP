import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { connectLocalDatabase } from "../helpers/local-database";
test("visual English-only leader and card galleries show previews, independent variant quantities and secure image boundaries", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  const email = `visual-${randomUUID()}@example.com`,
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
    let db = await connectLocalDatabase();
    try {
      const user = (
        await db.query("select id from auth.users where email=$1", [email])
      ).rows[0].id;
      await db.query(
        "insert into cards(user_id,card_number,name,card_type,language,source,colors) values($1,'OP96-001','Synthetic Japanese leader','leader','ja','manual','{red}')",
        [user],
      );
    } finally {
      await db.end();
    }
    await page.goto("/decks/new");
    const gallery = page.getByRole("region", {
      name: "Buscar cartas para el mazo",
    });
    await expect(
      gallery.getByRole("heading", { name: "Elige tu líder" }),
    ).toBeVisible();
    await expect(
      gallery.getByText("Synthetic Japanese leader", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("option", {
        name: "OP96-001 · Synthetic Japanese leader",
      }),
    ).toHaveCount(0);
    const leader = gallery.getByRole("button", {
      name: "Elegir líder OP97-001 · Synthetic OPTCG leader",
      exact: true,
    });
    await expect(leader).toBeVisible();
    const art = leader.getByRole("img");
    await expect
      .poll(() => art.evaluate((e) => (e as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    const preview =
      "/api/cards/preview?url=" +
      encodeURIComponent(
        "https://optcgapi.com/media/static/Card_Images/OP97-001.jpg",
      );
    expect((await request.get(preview)).status()).toBe(401);
    const valid = await page.request.get(preview);
    expect(valid.status()).toBe(200);
    expect(valid.headers()["cache-control"]).toContain("no-store");
    for (const url of [
      "https://evil.invalid/a.jpg",
      "https://optcgapi.com/media/static/Card_Images/a.svg",
      "https://optcgapi.com:1234/media/static/Card_Images/a.jpg",
    ]) {
      expect(
        (
          await page.request.get(
            "/api/cards/preview?url=" + encodeURIComponent(url),
          )
        ).status(),
      ).toBe(400);
    }
    db = await connectLocalDatabase();
    try {
      expect(
        (
          await db.query(
            "select id from cards where user_id=(select id from auth.users where email=$1)",
            [email],
          )
        ).rows,
      ).toHaveLength(1);
    } finally {
      await db.end();
    }
    await leader.click();
    await expect(
      gallery.getByRole("heading", { name: "Busca tus cartas" }),
    ).toBeVisible();
    await expect(
      gallery.getByRole("button", { name: "Cartas del mazo", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    const base = gallery.getByRole("button", {
        name: "Añadir OP97-010 · Synthetic OPTCG character",
        exact: true,
      }),
      alt = gallery.getByRole("button", {
        name: "Añadir OP97-010 · Synthetic OPTCG character parallel",
        exact: true,
      });
    await expect(base).toBeVisible();
    await base.click();
    await expect(
      gallery.getByRole("status", {
        name: "Contador del mazo: 1 de 50 cartas",
      }),
    ).toBeVisible();
    await expect(alt).toBeEnabled();
    await alt.click();
    await expect(
      gallery.getByRole("status", {
        name: "Contador del mazo: 2 de 50 cartas",
      }),
    ).toBeVisible();
    await expect(
      gallery.getByLabel("Copias OP97-010 · Synthetic OPTCG character: 1", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      gallery.getByLabel(
        "Copias OP97-010 · Synthetic OPTCG character parallel: 1",
        { exact: true },
      ),
    ).toBeVisible();
    await gallery
      .getByRole("button", {
        name: "Quitar OP97-010 · Synthetic OPTCG character",
        exact: true,
      })
      .click();
    await expect(
      gallery.getByRole("status", {
        name: "Contador del mazo: 1 de 50 cartas",
      }),
    ).toBeVisible();
    await expect(
      gallery.getByRole("button", {
        name: "Quitar OP97-010 · Synthetic OPTCG character",
        exact: true,
      }),
    ).toBeDisabled();
    await gallery.getByRole("button", { name: "Líderes", exact: true }).click();
    await expect(
      gallery.getByRole("button", {
        name: "Elegir líder OP97-001 · Synthetic OPTCG leader",
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    for (const width of [390, 320, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    await page.getByLabel("Nombre del mazo").fill("Visual variant draft");
    await page
      .getByRole("button", { name: "Guardar mazo", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Visual variant draft", exact: true }),
    ).toBeVisible();
    db = await connectLocalDatabase();
    try {
      const rows = (
        await db.query(
          "select c.provider_card_id,d.quantity from deck_cards d join cards c on c.id=d.card_id where d.deck_version_id in(select id from deck_versions where user_id=(select id from auth.users where email=$1)) and d.role='main'",
          [email],
        )
      ).rows;
      expect(rows).toEqual([
        { provider_card_id: "optcg_sets_OP97-010_p1", quantity: 1 },
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

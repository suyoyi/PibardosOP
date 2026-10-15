import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { connectLocalDatabase } from "../helpers/local-database";
test("grouped leader/card variants preserve exact artwork, shared limits, zoom, keyboard access and private preview boundaries", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(10000);
  const email = `visual-${randomUUID()}@example.com`;
  const ownedCards = async () => {
    const db = await connectLocalDatabase();
    try {
      return (
        await db.query(
          "select provider_card_id from cards where user_id=(select id from auth.users where email=$1)",
          [email],
        )
      ).rows;
    } finally {
      await db.end();
    }
  };
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
    const db = await connectLocalDatabase();
    try {
      await db.query(
        "insert into cards(user_id,card_number,name,card_type,language,source,colors) values((select id from auth.users where email=$1),'OP96-001','Synthetic Japanese leader','leader','ja','manual','{red}')",
        [email],
      );
    } finally {
      await db.end();
    }
    await page.goto("/decks/new");
    const gallery = page.getByRole("region", {
      name: "Buscar cartas para el mazo",
    });
    await gallery.getByLabel("Buscar carta").fill("OP97-001");
    const leaderGroup = gallery.getByRole("button", {
      name: /^Ver variantes OP97-001 ·/,
    });
    await expect(leaderGroup).toHaveCount(1);
    await expect(
      gallery.getByText("Synthetic Japanese leader", { exact: true }),
    ).toHaveCount(0);
    const art = leaderGroup.getByRole("img");
    await expect
      .poll(() =>
        art.evaluate((element) => (element as HTMLImageElement).naturalWidth),
      )
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
    ])
      expect(
        (
          await page.request.get(
            "/api/cards/preview?url=" + encodeURIComponent(url),
          )
        ).status(),
      ).toBe(400);
    await leaderGroup.click();
    const leaderDialog = page.getByRole("dialog", {
      name: "Variantes de OP97-001",
      exact: true,
    });
    await expect(
      leaderDialog
        .getByRole("list", { name: "Cuadrícula de variantes" })
        .getByRole("listitem"),
    ).toHaveCount(2);
    expect(await ownedCards()).toHaveLength(1); // Browsing art/variants creates no provider records.
    await page.keyboard.press("Escape");
    await expect(leaderDialog).toHaveCount(0);
    await expect(leaderGroup).toBeFocused();
    await leaderGroup.click();
    await leaderDialog
      .getByRole("button", {
        name: "Elegir líder OP97-001 · Synthetic OPTCG leader parallel",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", { name: "2. Cartas", exact: true }),
    ).toHaveAttribute("aria-current", "step");
    await expect(leaderDialog).toHaveCount(0);
    const context = gallery.getByRole("region", {
      name: "Líder del mazo seleccionado",
    });
    await expect(context).toContainText("Synthetic OPTCG leader parallel");
    const zoom = context.getByRole("button", {
      name: /Ampliar líder OP97-001/,
    });
    await zoom.click();
    const zoomDialog = page.getByRole("dialog", {
      name: "Líder seleccionado · OP97-001",
      exact: true,
    });
    await expect(zoomDialog.getByRole("img")).toHaveAttribute(
      "src",
      /\/api\/cards\/.+\/image/,
    );
    await expect(zoomDialog).toContainText("OP97-001_p1");
    await page.keyboard.press("Escape");
    await expect(zoomDialog).toHaveCount(0);
    await expect(zoom).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe("");
    await gallery
      .getByLabel("Expansión", { exact: true })
      .selectOption("OP-97");
    await gallery.getByLabel("Buscar carta").fill("parallel");
    const group = gallery.getByRole("button", {
      name: /^Ver variantes OP97-010 ·/,
    });
    await expect(group).toHaveCount(1);
    await expect(
      gallery.getByRole("button", { name: /Ver variantes OP97-011/ }),
    ).toHaveCount(0);
    await group.click();
    const variants = page.getByRole("dialog", {
      name: "Variantes de OP97-010",
      exact: true,
    });
    await expect(
      variants
        .getByRole("list", { name: "Cuadrícula de variantes" })
        .getByRole("listitem"),
    ).toHaveCount(3);
    await expect(variants).toContainText("ST-97"); // Source reprint is outside the active expansion/name filter.
    expect(await ownedCards()).toHaveLength(2);
    const base = variants.getByRole("button", {
      name: "Añadir OP97-010 · Synthetic OPTCG character",
      exact: true,
    });
    const alt = variants.getByRole("button", {
      name: "Añadir OP97-010 · Synthetic OPTCG character parallel",
      exact: true,
    });
    const reprint = variants.getByRole("button", {
      name: "Añadir OP97-010 · Synthetic OPTCG reprint",
      exact: true,
    });
    await base.click();
    await alt.click();
    await reprint.click();
    await base.click();
    await expect(base).toBeDisabled();
    await expect(alt).toBeDisabled();
    await expect(reprint).toBeDisabled();
    await expect(
      variants
        .getByRole("status")
        .filter({ hasText: "4/4 copias compartidas" }),
    ).toBeVisible();
    await variants
      .getByRole("button", {
        name: "Quitar OP97-010 · Synthetic OPTCG character parallel",
        exact: true,
      })
      .click();
    await expect(reprint).toBeEnabled();
    await reprint.click();
    await expect(
      variants.getByLabel("Copias OP97-010 · Synthetic OPTCG character: 2", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      variants.getByLabel("Copias OP97-010 · Synthetic OPTCG reprint: 2", {
        exact: true,
      }),
    ).toBeVisible();
    const close = variants.getByRole("button", {
      name: "Cerrar ventana",
      exact: true,
    });
    const last = variants.locator("button:enabled").last();
    await last.focus();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(last).toBeFocused();
    for (const width of [390, 320, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);
      expect(
        await variants.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true);
    }
    await close.click();
    await expect(group).toBeFocused();
    await expect(
      gallery.getByLabel("Copias OP97-010: 4", { exact: true }),
    ).toBeVisible();
    await group.click();
    await expect(
      variants
        .getByRole("list", { name: "Cuadrícula de variantes" })
        .getByRole("listitem"),
    ).toHaveCount(3);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "1. Líder", exact: true }).click();
    const selectedGroup = gallery.getByRole("button", {
      name: /^Ver variantes OP97-001 ·/,
    });
    await expect(selectedGroup).toHaveAttribute("aria-pressed", "true");
    await selectedGroup.click();
    await page
      .getByRole("dialog", { name: "Variantes de OP97-001" })
      .getByRole("button", {
        name: "Elegir líder OP97-001 · Synthetic OPTCG leader parallel",
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: "Continuar al nombre" }).click();
    await page.getByLabel("Nombre del mazo").fill("Visual variant draft");
    await page
      .getByRole("button", { name: "Guardar mazo", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Visual variant draft", exact: true }),
    ).toBeVisible();
    const verify = await connectLocalDatabase();
    try {
      const rows = (
        await verify.query(
          "select c.provider_card_id,d.quantity from deck_cards d join cards c on c.id=d.card_id where d.deck_version_id in(select id from deck_versions where user_id=(select id from auth.users where email=$1)) and d.role='main' order by c.provider_card_id",
          [email],
        )
      ).rows;
      expect(rows).toEqual([
        { provider_card_id: "optcg_promos_OP97-010_r1", quantity: 2 },
        { provider_card_id: "optcg_sets_OP97-010", quantity: 2 },
      ]);
      expect(
        (
          await verify.query(
            "select c.provider_card_id from deck_versions v join cards c on c.id=v.leader_card_id where v.user_id=(select id from auth.users where email=$1)",
            [email],
          )
        ).rows,
      ).toEqual([{ provider_card_id: "optcg_sets_OP97-001_p1" }]);
    } finally {
      await verify.end();
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

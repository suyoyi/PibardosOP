import { test, expect, type Page } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { fanEdition, fanCrew } from "../../src/domain/fan-cards";
import {
  fanCardFixtures,
  fanVariantFixtures,
  suAlternateImageHash,
  vinFanCard,
  suFanCard,
} from "../fixtures/fan-cards";
import { connectLocalDatabase } from "../helpers/local-database";

for (const { card, imageHash, width } of fanCardFixtures) {
  test(`${card.name} belongs to the fan edition, preserves the original JPEG and opens image-only in catalog and builder`, async ({
    page,
    request,
  }) => {
    test.setTimeout(90000);
    const email = `fan-edition-${randomUUID()}@example.com`;
    const imagePath = `/api/custom-artworks/${card.artwork_id}/image`;
    const variant = fanVariantFixtures.find((v) => v.fan_card_id === card.id);
    if (variant)
      expect(
        (
          await request.get(`/api/custom-artworks/${variant.artwork_id}/image`)
        ).status(),
      ).toBe(401);
    expect((await request.get(imagePath)).status()).toBe(401);
    try {
      await page.goto("/login");
      await page
        .getByRole("button", { name: "Crear mi primera cuenta" })
        .click();
      await page.getByLabel("Correo electrónico").fill(email);
      await page
        .getByLabel("Contraseña", { exact: true })
        .fill(`Test-${randomUUID()}`);
      await page
        .getByRole("button", { name: "Crear cuenta", exact: true })
        .click();
      await expect(page).toHaveURL("/");
      await page.goto("/cards");
      const fanCards = page.getByRole("list", {
        name: "Cartas de la edición personalizada",
        exact: true,
      });
      await expect(fanCards).toHaveCount(0);
      await expect(
        page.getByRole("status").filter({ hasText: "5 cartas" }),
      ).toBeVisible();
      await page.getByLabel("Coste", { exact: true }).selectOption("3");
      await expect(fanCards).toHaveCount(0);
      await page
        .getByLabel("Expansión", { exact: true })
        .selectOption({ label: fanEdition.name });
      await expect(fanCards.getByRole("button")).toHaveCount(
        fanCardFixtures.length,
      );
      await expect(fanCards.getByRole("button")).toHaveText([
        "Músico de la tripulación",
        "Tirador de la tripulación",
        "Luchador de la tripulación",
        "Espadachín de la tripulación",
        "Navegante de la tripulación",
        "Médico de la tripulación",
        "Capitán de la tripulación",
      ]);
      await expect(fanCards.getByRole("img")).toHaveCount(0);
      await expect(fanCards).not.toContainText(card.name);
      expect((await page.request.get(imagePath)).status()).toBe(403);
      if (variant)
        expect(
          (
            await page.request.get(
              `/api/custom-artworks/${variant.artwork_id}/image`,
            )
          ).status(),
        ).toBe(403);
      await expect(fanCards).not.toContainText(
        /Roronoa Vinny|Rocks D. Bermejo/,
      );
      await expect(
        page.getByRole("list", {
          name: "Resultados del catálogo",
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(page.getByLabel("Coste", { exact: true })).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Más filtros", exact: true }),
      ).toHaveCount(0);
      const role = fanCrew.find((member) => member.cardId === card.id)!.role;
      await fanCards.getByRole("button", { name: role, exact: true }).click();
      await expect(
        page.getByRole("dialog", { name: card.name, exact: true }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(
        fanCards.getByRole("button", {
          name: `Ver carta fan ${card.name}`,
          exact: true,
        }),
      ).toBeFocused();
      for (const query of [card.name, card.display_number!]) {
        await page.getByLabel("Buscar carta", { exact: true }).fill(query);
        await expect(fanCards.getByRole("button")).toHaveCount(1);
      }
      await page.getByLabel("Buscar carta", { exact: true }).fill("OP12-020");
      await expect(
        page.getByText("No hay cartas con esta búsqueda en la edición.", {
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Limpiar búsqueda", exact: true })
        .click();
      const tile = fanCards.getByRole("button", {
        name: `Ver carta fan ${card.name}`,
        exact: true,
      });
      await tile.click();
      const modal = page.getByRole("dialog", {
        name: card.name,
        exact: true,
      });
      await expect(modal).toBeVisible();
      await expect(modal.getByRole("img")).toHaveCount(variant ? 3 : 1);
      await expect(modal.getByRole("button")).toHaveCount(variant ? 3 : 1);
      await expect(modal.locator("dl, section, a")).toHaveCount(0);
      await expect(modal).not.toContainText(
        /Coste|Habilidad|Precio|Counter|Poder|Histórico/,
      );
      const image = modal
        .getByRole("group", { name: "Carta ampliada", exact: true })
        .getByRole("img", {
          name: `Ilustración de ${card.name}`,
          exact: true,
        });
      await expect
        .poll(() => image.evaluate((e) => (e as HTMLImageElement).naturalWidth))
        .toBe(width);
      const response = await page.request.get(imagePath);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toBe("image/jpeg");
      expect(response.headers()["cache-control"]).toBe("private, no-store");
      expect(
        createHash("sha256")
          .update(await response.body())
          .digest("hex"),
      ).toBe(imageHash);
      const checkVariants = async () => {
        const picker = modal.getByRole("group", {
          name: "Variantes de la carta",
          exact: true,
        });
        if (!variant) {
          await expect(picker).toHaveCount(0);
          return;
        }
        await expect(picker.getByRole("button")).toHaveCount(2);
        const original = picker.getByRole("button", {
          name: "Ver variante Original",
          exact: true,
        });
        const alternate = picker.getByRole("button", {
          name: `Ver variante ${variant.label}`,
          exact: true,
        });
        await expect(original).toHaveAttribute("aria-pressed", "true");
        await expect(alternate).toHaveAttribute("aria-pressed", "false");
        await alternate.click();
        await expect(alternate).toHaveAttribute("aria-pressed", "true");
        await expect(original).toHaveAttribute("aria-pressed", "false");
        const alternatePath = `/api/custom-artworks/${variant.artwork_id}/image`;
        await expect(image).toHaveAttribute(
          "src",
          new RegExp(`${alternatePath}$`),
        );
        await expect
          .poll(() =>
            image.evaluate((e) => (e as HTMLImageElement).naturalWidth),
          )
          .toBe(960);
        const alternateResponse = await page.request.get(alternatePath);
        expect(alternateResponse.status()).toBe(200);
        expect(alternateResponse.headers()["content-type"]).toBe("image/jpeg");
        expect(alternateResponse.headers()["cache-control"]).toBe(
          "private, no-store",
        );
        expect(
          createHash("sha256")
            .update(await alternateResponse.body())
            .digest("hex"),
        ).toBe(suAlternateImageHash);
        await original.click();
        await expect(original).toHaveAttribute("aria-pressed", "true");
        await expect(image).toHaveAttribute("src", new RegExp(`${imagePath}$`));
        await expect
          .poll(() =>
            image.evaluate((e) => (e as HTMLImageElement).naturalWidth),
          )
          .toBe(width);
        await alternate.focus();
        await page.keyboard.press("Enter");
        await expect(alternate).toHaveAttribute("aria-pressed", "true");
        await expect(image).toHaveAttribute(
          "src",
          new RegExp(`${alternatePath}$`),
        );
      };
      await checkVariants();
      for (const width of [320, 390, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        expect(
          await modal.evaluate((e) => e.scrollWidth <= e.clientWidth),
        ).toBe(true);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: `/tmp/pibardos-${card.artwork_id}.png` });
      await page.keyboard.press("Escape");
      await expect(modal).toHaveCount(0);
      await expect(tile).toBeFocused();
      await page
        .getByRole("button", { name: "Limpiar filtros", exact: true })
        .click();
      await expect(
        page
          .getByRole("list", { name: "Resultados del catálogo", exact: true })
          .getByRole("button", { name: /^Ver carta / }),
      ).toHaveCount(5);
      await expect(fanCards).toHaveCount(0);
      await page.getByLabel("Expansión", { exact: true }).selectOption("OP12");
      await expect(fanCards).toHaveCount(0);
      await page.goto("/decks/new");
      await page
        .getByLabel("Expansión", { exact: true })
        .selectOption({ label: fanEdition.name });
      await expect(fanCards.getByRole("button")).toHaveCount(
        fanCardFixtures.length,
      );
      await expect(
        page.getByRole("list", { name: "Cuadrícula de cartas", exact: true }),
      ).toHaveCount(0);
      await expect(
        fanCards.getByRole("button", { name: /Elegir|Añadir/ }),
      ).toHaveCount(0);
      await fanCards
        .getByRole("button", {
          name: `Ver carta fan ${card.name}`,
          exact: true,
        })
        .click();
      await expect(modal.getByRole("img")).toHaveCount(variant ? 3 : 1);
      await expect(modal.getByRole("button")).toHaveCount(variant ? 3 : 1);
      await expect(modal).not.toContainText(
        /Coste|Habilidad|Precio|Counter|Poder|Histórico/,
      );
      await checkVariants();
      await page.keyboard.press("Escape");
      await expect(modal).toHaveCount(0);
      await page.getByLabel("Expansión", { exact: true }).selectOption("OP12");
      await expect(fanCards).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /^Ver variantes OP12-020 ·/ }),
      ).toBeVisible();
    } finally {
      const db = await connectLocalDatabase();
      try {
        await db.query("delete from auth.users where email=$1", [email]);
      } finally {
        await db.end();
      }
    }
  });
}

test("crew discoveries survive filters, builder navigation and a fresh session, stay private and can retry failed saves", async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  const ownerEmail = `fan-discovery-${randomUUID()}@example.com`;
  const otherEmail = `fan-discovery-other-${randomUUID()}@example.com`;
  const password = `Test-${randomUUID()}`;
  const gallery = (target: Page) =>
    target.getByRole("list", {
      name: "Cartas de la edición personalizada",
      exact: true,
    });
  const chooseEdition = async (target: Page) => {
    await target
      .getByLabel("Expansión", { exact: true })
      .selectOption({ label: fanEdition.name });
    await expect(gallery(target).getByRole("button")).toHaveCount(7);
  };
  const signup = async (target: Page, email: string) => {
    await target.goto("/login");
    await target
      .getByRole("button", { name: "Crear mi primera cuenta" })
      .click();
    await target.getByLabel("Correo electrónico").fill(email);
    await target.getByLabel("Contraseña", { exact: true }).fill(password);
    await target
      .getByRole("button", { name: "Crear cuenta", exact: true })
      .click();
    await expect(target).toHaveURL("/");
  };
  const vinTile = (target: Page) =>
    gallery(target).getByRole("button", {
      name: `Ver carta fan ${vinFanCard.name}`,
      exact: true,
    });
  const otherContext = await browser.newContext();
  const freshContext = await browser.newContext();
  try {
    await signup(page, ownerEmail);
    await page.goto("/cards");
    await page
      .getByLabel("Buscar carta", { exact: true })
      .fill(vinFanCard.name);
    await expect(gallery(page)).toHaveCount(0);
    await page.getByLabel("Buscar carta", { exact: true }).fill("");
    await chooseEdition(page);
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await gallery(page).screenshot({ path: "/tmp/pibardos-crew-locked.png" });
    const musician = gallery(page).getByRole("button", {
      name: "Músico de la tripulación",
      exact: true,
    });
    await page.route("**/cards", (route) =>
      route.request().method() === "POST"
        ? route.abort("failed")
        : route.continue(),
    );
    await musician.click();
    await expect(
      page
        .getByRole("region", { name: fanEdition.name, exact: true })
        .getByRole("alert"),
    ).toContainText("No se pudo guardar el desbloqueo");
    await expect(musician).toBeEnabled();
    await expect(gallery(page).getByRole("img")).toHaveCount(0);
    expect(
      (
        await page.request.get(
          `/api/custom-artworks/${vinFanCard.artwork_id}/image`,
        )
      ).status(),
    ).toBe(403);
    await page.unroute("**/cards");
    await musician.click();
    await expect(
      page.getByRole("dialog", { name: vinFanCard.name, exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(vinTile(page)).toBeVisible();
    await expect(musician).toHaveCount(0);
    await page
      .getByRole("button", { name: "Limpiar filtros", exact: true })
      .click();
    await expect(gallery(page)).toHaveCount(0);
    await chooseEdition(page);
    await expect(vinTile(page)).toBeVisible();
    await page.reload();
    await expect(gallery(page)).toHaveCount(0);
    await chooseEdition(page);
    await expect(vinTile(page)).toBeVisible();
    await page.goto("/decks/new");
    await chooseEdition(page);
    await expect(vinTile(page)).toBeVisible();
    await gallery(page)
      .getByRole("button", { name: "Capitán de la tripulación", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: suFanCard.name, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Ver variante Arte alternativo",
        exact: true,
      }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByLabel("Expansión", { exact: true }).selectOption("OP12");
    await chooseEdition(page);
    await expect(
      gallery(page).getByRole("button", {
        name: `Ver carta fan ${suFanCard.name}`,
        exact: true,
      }),
    ).toBeVisible();

    await page
      .getByRole("navigation", { name: "Navegación principal", exact: true })
      .getByRole("link", { name: "Cartas", exact: true })
      .click();
    await chooseEdition(page);
    await expect(vinTile(page)).toBeVisible();
    await expect(
      gallery(page).getByRole("button", {
        name: `Ver carta fan ${suFanCard.name}`,
        exact: true,
      }),
    ).toBeVisible();

    const fresh = await freshContext.newPage();
    await fresh.goto("/login");
    await fresh.getByLabel("Correo electrónico").fill(ownerEmail);
    await fresh.getByLabel("Contraseña", { exact: true }).fill(password);
    await fresh
      .getByRole("button", { name: "Entrar a mi espacio", exact: true })
      .click();
    await expect(fresh).toHaveURL("/");
    await fresh.goto("/cards");
    await chooseEdition(fresh);
    await expect(vinTile(fresh)).toBeVisible();
    await expect(
      gallery(fresh).getByRole("button", {
        name: `Ver carta fan ${suFanCard.name}`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      gallery(fresh).getByRole("button", {
        name: "Tirador de la tripulación",
        exact: true,
      }),
    ).toBeVisible();
    await gallery(fresh).screenshot({
      path: "/tmp/pibardos-crew-discovered.png",
    });

    const other = await otherContext.newPage();
    await signup(other, otherEmail);
    await other.goto("/cards");
    await chooseEdition(other);
    await expect(gallery(other).getByRole("img")).toHaveCount(0);
    await expect(
      gallery(other).getByRole("button", {
        name: "Músico de la tripulación",
        exact: true,
      }),
    ).toBeVisible();
    for (const art of [
      vinFanCard.artwork_id,
      suFanCard.artwork_id,
      "su-d-yoyi-awakening",
    ])
      expect(
        (await other.request.get(`/api/custom-artworks/${art}/image`)).status(),
      ).toBe(403);
    const db = await connectLocalDatabase();
    try {
      expect(
        (
          await db.query(
            "select f.fan_card_id from fan_card_unlocks f join auth.users u on u.id=f.user_id where u.email=$1 order by f.fan_card_id",
            [ownerEmail],
          )
        ).rows
          .map((r) => r.fan_card_id)
          .sort(),
      ).toEqual([vinFanCard.id, suFanCard.id].sort());
      expect(
        (
          await db.query(
            "select f.* from fan_card_unlocks f join auth.users u on u.id=f.user_id where u.email=$1",
            [otherEmail],
          )
        ).rows,
      ).toHaveLength(0);
    } finally {
      await db.end();
    }
  } finally {
    await otherContext.close();
    await freshContext.close();
    const cleanup = await connectLocalDatabase();
    try {
      await cleanup.query(
        "delete from auth.users where email=any($1::text[])",
        [[ownerEmail, otherEmail]],
      );
    } finally {
      await cleanup.end();
    }
  }
});

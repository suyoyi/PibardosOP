import { test, expect } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { fanEdition } from "../../src/domain/fan-cards";
import {
  fanCardFixtures,
  fanVariantFixtures,
  suAlternateImageHash,
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
      await expect(
        fanCards.getByRole("button", {
          name: `Ver carta fan ${card.name}`,
          exact: true,
        }),
      ).toBeVisible();
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
      await expect(fanCards.getByRole("button")).toHaveCount(
        fanCardFixtures.length,
      );
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

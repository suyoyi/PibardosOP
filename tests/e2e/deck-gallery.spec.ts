import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { connectLocalDatabase } from "../helpers/local-database";
import { normalizeOptcgCard } from "../../src/domain/optcg";
import { optcgRecord } from "../fixtures/optcg";

test("deck artwork gallery values exact printings and quantities, opens accessible details and retains immutable lists", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  const email = `deck-gallery-${randomUUID()}@example.com`,
    foreign = randomUUID(),
    deckId = randomUUID(),
    foreignDeck = randomUUID();
  let owner = "",
    baseId = "",
    manualId = "",
    leaderId = "",
    firstVersion = "",
    foreignLeaderId = "";
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
      owner = (
        await db.query("select id from auth.users where email=$1", [email])
      ).rows[0].id;
      await db.query("insert into auth.users(id,email) values($1,$2)", [
        foreign,
        `${foreign}@example.invalid`,
      ]);
      await db.query("begin");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        owner,
      ]);
      await db.query("set local role authenticated");
      const facts = [
        normalizeOptcgCard(
          optcgRecord({
            card_set_id: "OP97-001",
            card_image_id: "OP97-001",
            card_name: "Synthetic gallery leader",
            card_type: "Leader",
            card_cost: null,
            life: 5,
            market_price: 3,
            card_image:
              "https://optcgapi.com/media/static/Card_Images/OP97-001.jpg",
          }),
          "sets",
        ),
        normalizeOptcgCard(optcgRecord(), "sets"),
        normalizeOptcgCard(
          optcgRecord({
            card_image_id: "OP97-010_p1",
            card_name: "Synthetic OPTCG character parallel",
            market_price: 0,
            card_image:
              "https://optcgapi.com/media/static/Card_Images/OP97-010_p1.jpg",
          }),
          "sets",
        ),
        normalizeOptcgCard(
          optcgRecord({
            card_set_id: "OP97-020",
            card_image_id: "OP97-020",
            card_type: "Event",
            card_name: "Synthetic gallery event",
            card_cost: 1,
            market_price: 1.2,
          }),
          "sets",
        ),
        normalizeOptcgCard(
          optcgRecord({
            card_type: "DON!!",
            card_image_id: "DON97",
            card_name: "Synthetic gallery DON",
            card_cost: null,
            market_price: 0.1,
          }),
          "don",
        ),
      ];
      const ids: string[] = [];
      for (const card of facts)
        ids.push(
          (await db.query("select cache_optcg_card($1) as id", [card])).rows[0]
            .id,
        );
      [leaderId, baseId] = ids;
      manualId = (
        await db.query(
          "insert into cards(user_id,card_number,name,card_type,source,colors,cost,effect_text) values($1,'OP97-099','Synthetic unpriced card','character','manual','{red}',null,$2) returning id",
          [owner, "<script>untrusted text</script>"],
        )
      ).rows[0].id;
      await db.query("select save_deck($1)", [
        {
          id: deckId,
          expected_version_id: "",
          name: "Synthetic visual price deck",
          leader_card_id: leaderId,
          format: "standard",
          status: "draft",
          cards: [
            { card_id: ids[1], quantity: 3, role: "main" },
            { card_id: ids[2], quantity: 1, role: "main" },
            { card_id: ids[3], quantity: 2, role: "main" },
            { card_id: manualId, quantity: 2, role: "main" },
            { card_id: ids[4], quantity: 10, role: "don" },
          ],
        },
      ]);
      firstVersion = (
        await db.query("select current_version_id from decks where id=$1", [
          deckId,
        ])
      ).rows[0].current_version_id;
      await db.query("commit");
      await db.query("begin");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        foreign,
      ]);
      await db.query("set local role authenticated");
      const other = (
        await db.query("select cache_optcg_card($1) as id", [
          {
            ...facts[0],
            prices: [{ metric: "market_price", amount: 999, currency: null }],
          },
        ])
      ).rows[0].id;
      foreignLeaderId = other;
      await db.query("select save_deck($1)", [
        {
          id: foreignDeck,
          expected_version_id: "",
          name: "Foreign private deck",
          leader_card_id: other,
          format: "standard",
          status: "draft",
          cards: [],
        },
      ]);
      await db.query("commit");
    } finally {
      await db.end();
    }
    await page.goto(`/decks/${deckId}`);
    const valuation = page.getByRole("region", {
      name: "Valoración del mazo",
      exact: true,
    });
    await expect(valuation).toContainText("Subtotal conocido del mazo");
    await expect(valuation).toContainText("13,90");
    await expect(valuation).toContainText("17 de 19 copias");
    await expect(valuation).toContainText("5 de 6 impresiones");
    await expect(valuation).toContainText("Falta el precio de 2 copias");
    await expect(valuation).toContainText("Moneda no especificada");
    await expect(valuation).not.toContainText("999");
    await expect(valuation).not.toContainText("$");
    await expect(valuation).not.toContainText("€");
    const gallery = page.getByRole("region", {
      name: "Cartas: Lista del mazo",
      exact: true,
    });
    await expect(gallery.getByRole("button")).toHaveCount(5);
    const base = gallery.getByRole("button", {
      name: "Ver carta OP97-010 · OP97-010 · Synthetic OPTCG character",
      exact: true,
    });
    const alt = gallery.getByRole("button", {
      name: "Ver carta OP97-010 · OP97-010_p1 · Synthetic OPTCG character parallel",
      exact: true,
    });
    await expect(base).toContainText("3 × 2,50 = 7,50");
    await expect(alt).toContainText("1 × 0,00 = 0,00");
    await expect(
      page.getByRole("region", { name: "Cartas: DON!! separado", exact: true }),
    ).toContainText("10 × 0,10 = 1,00");
    await base.scrollIntoViewIfNeeded();
    await base.click();
    const dialog = page.getByRole("dialog", {
      name: "Detalle de OP97-010",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(`/decks/${deckId}`);
    await expect(dialog).toContainText("Synthetic effect");
    await expect(dialog).toContainText("Synthetic trait block");
    await expect(
      dialog.getByRole("region", { name: "Precio de la carta en el mazo" }),
    ).toContainText("Subtotal 7,50");
    const art = dialog.getByRole("img", {
      name: "Ilustración de Synthetic OPTCG character",
      exact: true,
    });
    await expect
      .poll(() => art.evaluate((e) => (e as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await expect(art).toHaveAttribute(
      "src",
      new URL(`/api/cards/${baseId}/image`, page.url()).href,
    );
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe("hidden");
    await dialog
      .getByRole("button", { name: "Carta siguiente", exact: true })
      .click();
    await expect(
      dialog.getByRole("heading", {
        name: "Synthetic OPTCG character parallel",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("region", { name: "Precio de la carta en el mazo" }),
    ).toContainText("Subtotal 0,00");
    await dialog
      .getByRole("button", { name: "Carta anterior", exact: true })
      .click();
    await expect(art).toBeVisible();
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
        true,
      );
    }
    await dialog.screenshot({
      path: "/tmp/pibardos-deck-detail-synthetic.png",
    });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(base).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe("");
    await page.getByRole("button", { name: /Ver carta OP97-099/ }).click();
    const manual = page.getByRole("dialog", { name: "Detalle de OP97-099" });
    await expect(manual).toContainText("<script>untrusted text</script>");
    await expect(manual.locator("script")).toHaveCount(0);
    await expect(
      manual.getByRole("region", { name: "Precio de la carta en el mazo" }),
    ).toContainText("Sin precio");
    await manual.getByRole("button", { name: "Cerrar ventana" }).click();
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.screenshot({
      path: "/tmp/pibardos-deck-gallery-synthetic.png",
      fullPage: true,
    });
    const update = await connectLocalDatabase();
    try {
      await update.query("begin");
      await update.query("select set_config('request.jwt.claim.sub',$1,true)", [
        owner,
      ]);
      await update.query("set local role authenticated");
      await update.query("select cache_optcg_card($1)", [
        normalizeOptcgCard(
          optcgRecord({
            market_price: 4,
            card_text:
              "Changed upstream text must not replace historical facts",
          }),
          "sets",
        ),
      ]);
      await update.query("commit");
      const snapshot = (
        await update.query("select current_version_id from decks where id=$1", [
          deckId,
        ])
      ).rows[0];
      expect(snapshot.current_version_id).toBe(firstVersion);
      expect(
        (
          await update.query("select effect_text from cards where id=$1", [
            baseId,
          ])
        ).rows[0].effect_text,
      ).toBe("Synthetic effect");
      for (const table of ["collection_items", "wishlist_items", "matches"])
        expect(
          (
            await update.query(`select id from ${table} where user_id=$1`, [
              owner,
            ])
          ).rows,
        ).toEqual([]);
    } finally {
      await update.end();
    }
    await page.reload();
    await expect(valuation).toContainText("18,40");
    await expect(base).toContainText("3 × 4,00 = 12,00");
    await base.click();
    await dialog
      .getByRole("button", { name: "Consultar precios de nuevo" })
      .click();
    await expect(
      dialog.getByRole("status").filter({ hasText: "menos de 15 minutos" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    // Removing only the unpriced row produces a complete total in a new snapshot.
    const finish = await connectLocalDatabase();
    try {
      const rows = (
        await finish.query(
          "select card_id,quantity,role from deck_cards where deck_version_id=$1",
          [firstVersion],
        )
      ).rows;
      await finish.query("begin");
      await finish.query("select set_config('request.jwt.claim.sub',$1,true)", [
        owner,
      ]);
      await finish.query("set local role authenticated");
      await finish.query("select save_deck($1)", [
        {
          id: deckId,
          expected_version_id: firstVersion,
          name: "Synthetic visual price deck",
          leader_card_id: leaderId,
          format: "standard",
          status: "draft",
          cards: rows.filter((r) => r.card_id !== manualId),
        },
      ]);
      await finish.query("commit");
      expect(
        (
          await finish.query(
            "select quantity from deck_cards where deck_version_id=$1 and card_id=$2",
            [firstVersion, manualId],
          )
        ).rows[0].quantity,
      ).toBe(2);
    } finally {
      await finish.end();
    }
    await page.reload();
    await expect(valuation).toContainText("Total orientativo del mazo");
    await expect(valuation).toContainText("17 de 17 copias");
    await expect(valuation).toContainText("18,40");
    // Next can stream the not-found UI with HTTP 200. Assert actual denial
    // and absence of private HTML/RSC data instead of assuming a status code.
    const denied = await page.goto(`/decks/${foreignDeck}`);
    await expect(
      page.getByRole("heading", { name: "404", exact: true }),
    ).toBeVisible();
    const deniedBody = await denied!.text();
    expect(deniedBody).not.toContain("Foreign private deck");
    expect(deniedBody).not.toContain(foreignLeaderId);
    const anonymous = await browser.newContext();
    try {
      const guest = await anonymous.newPage();
      await guest.goto(`/decks/${deckId}`);
      await expect(guest).toHaveURL(/\/login/);
      await expect(guest.getByLabel("Correo electrónico")).toBeVisible();
      await expect(
        guest.getByText("Synthetic visual price deck", { exact: true }),
      ).toHaveCount(0);
    } finally {
      await anonymous.close();
    }
  } finally {
    const cleanup = await connectLocalDatabase();
    await cleanup.query("delete from auth.users where email=$1 or id=$2", [
      email,
      foreign,
    ]);
    await cleanup.end();
  }
});

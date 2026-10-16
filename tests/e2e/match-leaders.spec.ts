import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { connectLocalDatabase } from "../helpers/local-database";
import { normalizeOptcgCard } from "../../src/domain/optcg";
import { optcgRecord } from "../fixtures/optcg";

test("match registration shows the exact version leader and a private visual opponent picker without alternate duplicates", async ({
  page,
}) => {
  test.setTimeout(90000);
  const email = `match-leaders-${randomUUID()}@example.com`,
    other = randomUUID(),
    deck = randomUUID();
  let original = "",
    alternate = "",
    version1 = "",
    version2 = "";
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
      const owner = (
        await db.query("select id from auth.users where email=$1", [email])
      ).rows[0].id;
      await db.query("begin");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        owner,
      ]);
      await db.query("set local role authenticated");
      for (const isAlternate of [false, true]) {
        const card = normalizeOptcgCard(
          optcgRecord({
            card_set_id: "OP96-001",
            card_image_id: isAlternate ? "OP96-001_p1" : "OP96-001",
            card_type: "Leader",
            card_name: isAlternate
              ? "Synthetic match alternate"
              : "Synthetic match original",
            card_image: `https://optcgapi.com/media/static/Card_Images/OP96-001${isAlternate ? "_p1" : ""}.jpg`,
          }),
          "sets",
        );
        const id = (await db.query("select cache_optcg_card($1) as id", [card]))
          .rows[0].id;
        if (isAlternate) alternate = id;
        else original = id;
        await db.query("select save_deck($1)", [
          {
            id: deck,
            expected_version_id: version1,
            name: "Synthetic match version deck",
            leader_card_id: id,
            format: "standard",
            status: "draft",
            cards: [],
          },
        ]);
        const v = (
          await db.query("select current_version_id from decks where id=$1", [
            deck,
          ])
        ).rows[0].current_version_id;
        if (isAlternate) version2 = v;
        else version1 = v;
      }
      await db.query("commit");
      await db.query("insert into auth.users(id,email) values($1,$2)", [
        other,
        `${other}@example.invalid`,
      ]);
      await db.query(
        "insert into cards(user_id,card_number,name,card_type,source,colors) values($1,'OP93-001','Hidden private opponent','leader','manual','{red}')",
        [other],
      );
    } finally {
      await db.end();
    }
    await page.goto(`/matches/new?version=${version1}`);
    const ownLeader = page.getByRole("region", {
      name: "Tu líder en la versión jugada",
    });
    await expect(
      ownLeader.getByText("Synthetic match original", { exact: true }),
    ).toBeVisible();
    await expect(ownLeader.getByRole("img")).toHaveAttribute(
      "src",
      new URL(`/api/cards/${original}/image`, page.url()).href,
    );
    await page.getByLabel("Mazo y versión jugada").selectOption(version2);
    await expect(
      ownLeader.getByText("Synthetic match alternate", { exact: true }),
    ).toBeVisible();
    await expect(ownLeader.getByRole("img")).toHaveAttribute(
      "src",
      new URL(`/api/cards/${alternate}/image`, page.url()).href,
    );
    await page.getByLabel("Mazo y versión jugada").selectOption(version1);
    await page.getByLabel("Victoria", { exact: true }).check();
    await page.getByLabel("Segundo", { exact: true }).check();
    await page.getByText("Fecha, rival y notas", { exact: true }).click();
    await page
      .getByLabel("Notas y observaciones")
      .fill("Keep unsaved match notes");
    await page
      .getByRole("button", { name: "Elegir líder rival", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Elegir líder rival",
      exact: true,
    });
    const search = dialog.getByLabel("Buscar líder rival", { exact: true });
    await search.fill("op97-1");
    await search.press("Enter");
    const opponent = dialog.getByRole("button", {
      name: "Elegir rival OP97-001 · Synthetic OPTCG leader",
      exact: true,
    });
    await expect(opponent).toBeVisible();
    await expect(
      dialog
        .getByRole("list", { name: "Líderes rivales disponibles" })
        .getByRole("button"),
    ).toHaveCount(1);
    await expect(opponent.getByRole("img")).toBeVisible();
    await expect
      .poll(() =>
        opponent
          .getByRole("img")
          .evaluate((e) => (e as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    await expect(page).toHaveURL(`/matches/new?version=${version1}`);
    await search.fill("Hidden private opponent");
    await expect(
      dialog
        .getByRole("list", { name: "Líderes rivales disponibles" })
        .getByRole("button"),
    ).toHaveCount(0);
    await search.fill("OP96-001");
    await expect(
      dialog
        .getByRole("list", { name: "Líderes rivales disponibles" })
        .getByRole("button"),
    ).toHaveCount(1);
    await expect(
      dialog.getByRole("button", {
        name: "Elegir rival OP96-001 · Synthetic match original",
        exact: true,
      }),
    ).toBeVisible();
    await search.fill("");
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
    const check = await connectLocalDatabase();
    try {
      const owner = (
        await check.query("select id from auth.users where email=$1", [email])
      ).rows[0].id;
      expect(
        (await check.query("select id from cards where user_id=$1", [owner]))
          .rowCount,
      ).toBe(2);
      expect(
        (await check.query("select id from matches where user_id=$1", [owner]))
          .rowCount,
      ).toBe(0);
    } finally {
      await check.end();
    }
    await opponent.click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Elegir líder rival", exact: true }),
    ).toBeFocused();
    await expect(page.getByLabel("Notas y observaciones")).toHaveValue(
      "Keep unsaved match notes",
    );
    await expect(page.getByLabel("Segundo", { exact: true })).toBeChecked();
    await expect(page.getByLabel("Mazo y versión jugada")).toHaveValue(
      version1,
    );
    await page
      .getByRole("button", { name: "Guardar partida", exact: true })
      .click();
    await expect(page).toHaveURL(/\/matches\?saved=1/);
    const verify = await connectLocalDatabase();
    let matchId = "";
    try {
      const owner = (
        await verify.query("select id from auth.users where email=$1", [email])
      ).rows[0].id;
      const row = (
        await verify.query(
          "select m.id,m.deck_version_id,m.went_first,m.result,m.notes,c.provider_card_id from matches m join cards c on c.id=m.opponent_leader_id where m.user_id=$1",
          [owner],
        )
      ).rows[0];
      expect(row).toMatchObject({
        deck_version_id: version1,
        went_first: false,
        result: "win",
        notes: "Keep unsaved match notes",
        provider_card_id: "optcg_sets_OP97-001",
      });
      expect(
        (await verify.query("select id from cards where user_id=$1", [owner]))
          .rowCount,
      ).toBe(3);
      matchId = row.id;
    } finally {
      await verify.end();
    }
    await page.goto(`/matches/${matchId}/edit`);
    await expect(ownLeader.getByRole("img")).toHaveAttribute(
      "src",
      new URL(`/api/cards/${original}/image`, page.url()).href,
    );
    await expect(
      page.getByRole("button", { name: "Elegir líder rival", exact: true }),
    ).toContainText("Synthetic OPTCG leader");
    await page
      .getByRole("button", { name: "Guardar cambios de partida", exact: true })
      .click();
    await expect(page).toHaveURL(/\/matches\?saved=1/);
  } finally {
    const db = await connectLocalDatabase();
    try {
      await db.query("delete from auth.users where email=$1 or id=$2", [
        email,
        other,
      ]);
    } finally {
      await db.end();
    }
  }
});

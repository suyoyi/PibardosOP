import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { connectLocalDatabase } from "../helpers/local-database";
import { normalizeBerryCard } from "../../src/domain/berrywallet";
import { berryRecord } from "../fixtures/berrywallet";
test("mobile historical BerryWallet cards remain readable without provider requests", async ({
  page,
  request,
}) => {
  const email = `provider-e2e-${randomUUID()}@example.com`,
    password = `Test-${randomUUID()}`,
    other = randomUUID();
  let ownCard = "",
    otherCard = "";
  try {
    await page.goto("/login");
    await page.getByRole("button", { name: "Crear mi primera cuenta" }).click();
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Crear cuenta", exact: true })
      .click();
    await expect(page).toHaveURL("/");
    const db = await connectLocalDatabase();
    try {
      const user = (
        await db.query("select id from auth.users where email=$1", [email])
      ).rows[0].id;
      await db.query("begin");
      await db.query("insert into auth.users(id,email) values($1,$2)", [
        other,
        `${other}@example.invalid`,
      ]);
      for (const owner of [user, other]) {
        await db.query("reset role");
        await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
          owner,
        ]);
        await db.query("set local role authenticated");
        const id = (
          await db.query("select cache_berrywallet_card($1) as id", [
            normalizeBerryCard(berryRecord(), "en"),
          ])
        ).rows[0].id;
        if (owner === user) ownCard = id;
        else otherCard = id;
      }
      await db.query("commit");
    } finally {
      await db.end();
    }
    await page.goto("/cards");
    await expect(
      page.getByRole("heading", { name: "OPTCG API", exact: true }),
    ).toBeVisible();
    await page.goto(`/cards/${ownCard}`);
    await expect(
      page.getByRole("heading", { name: "Precios de la impresión" }),
    ).toBeVisible();
    await expect(page.getByText(/2,50/)).toBeVisible();
    await expect(page.getByText(/1,25/)).toBeVisible();
    await expect(
      page.getByLabel("Sin ilustración de Synthetic provider character"),
    ).toBeVisible();
    await expect(page.getByText(/BerryWallet está retirado/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Consultar precios de nuevo" }),
    ).toHaveCount(0);
    expect((await request.get(`/api/cards/${ownCard}/image`)).status()).toBe(
      401,
    );
    expect(
      (await page.request.get(`/api/cards/${otherCard}/image`)).status(),
    ).toBe(404);
    expect(
      (await page.request.get(`/api/cards/${ownCard}/image`)).status(),
    ).toBe(404);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
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

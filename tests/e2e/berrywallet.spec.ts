import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { connectLocalDatabase } from "../helpers/local-database";
import { normalizeBerryCard } from "../../src/domain/berrywallet";
import { berryRecord } from "../fixtures/berrywallet";
test("mobile provider cache, quote reuse, image authorization and missing-provider import fallback", async ({
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
      page.getByText(
        "El proveedor no está conectado. Puedes usar el catálogo manual.",
      ),
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
    await page
      .getByRole("button", { name: "Consultar precios de nuevo" })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "menos de 15 minutos" }),
    ).toBeVisible();
    expect((await request.get(`/api/cards/${ownCard}/image`)).status()).toBe(
      401,
    );
    expect(
      (await page.request.get(`/api/cards/${otherCard}/image`)).status(),
    ).toBe(404);
    expect(
      (await page.request.get(`/api/cards/${ownCard}/image`)).status(),
    ).toBe(502);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.goto("/decks/new");
    await page.getByLabel("Lista de texto").fill("4 OP97-099");
    await page
      .getByRole("button", { name: "Revisar importación", exact: true })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "OP97-099 no está" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Resolver desconocidas con BerryWallet" })
      .click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Configura BERRYWALLET_API_KEY" }),
    ).toBeVisible();
    await expect(
      page.getByRole("alert").filter({ hasText: "OP97-099 no está" }),
    ).toBeVisible();
    await expect(page.getByLabel("Lista de texto")).toHaveValue("4 OP97-099");
    const audit = await connectLocalDatabase();
    try {
      const jobs = (
        await audit.query(
          "select error_report from import_jobs where user_id=(select id from auth.users where email=$1) order by created_at desc",
          [email],
        )
      ).rows;
      expect(jobs).toHaveLength(2);
      expect(
        jobs[0].error_report.some(
          (p: { code: string; message?: string }) =>
            p.code === "PROVIDER_NOTICE" &&
            p.message?.includes("BERRYWALLET_API_KEY"),
        ),
      ).toBe(true);
    } finally {
      await audit.end();
    }
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

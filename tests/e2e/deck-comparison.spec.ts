import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { connectLocalDatabase } from "../helpers/local-database";

test("two-deck statistics use actual snapshots, common filters and private mobile results", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  const email = `compare-${randomUUID()}@example.com`,
    otherEmail = `compare-other-${randomUUID()}@example.com`;
  const [a, b, c, foreign, leader, rival, alt] = Array.from({ length: 7 }, () =>
    randomUUID(),
  );
  const signup = async (target: typeof page, address: string) => {
    await target.goto("/login");
    await target
      .getByRole("button", { name: "Crear mi primera cuenta" })
      .click();
    await target.getByLabel("Correo electrónico").fill(address);
    await target
      .getByLabel("Contraseña", { exact: true })
      .fill(`Test-${randomUUID()}`);
    await target
      .getByRole("button", { name: "Crear cuenta", exact: true })
      .click();
    await expect(target).toHaveURL("/");
  };
  const other = await browser.newContext();
  try {
    await signup(page, email);
    await page.goto("/statistics/compare");
    await expect(
      page.getByRole("heading", { name: "Necesitas dos mazos para comparar" }),
    ).toBeVisible();
    await signup(await other.newPage(), otherEmail);
    const db = await connectLocalDatabase();
    try {
      const owner = (
        await db.query("select id from auth.users where email=$1", [email])
      ).rows[0].id;
      const otherOwner = (
        await db.query("select id from auth.users where email=$1", [otherEmail])
      ).rows[0].id;
      await db.query("begin");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        owner,
      ]);
      await db.query("set local role authenticated");
      for (const [id, code, name, canonical] of [
        [leader, "OP93-001", "Synthetic comparison leader", leader],
        [rival, "OP93-002", "Synthetic comparison rival", rival],
        [alt, "OP93-002", "Synthetic comparison rival alternate", rival],
      ]) {
        await db.query(
          "insert into cards(id,user_id,card_number,name,card_type,source,language,colors,canonical_card_id,printing_code) values($1,$2,$3,$4,'leader','manual','en','{red}',$5,$6)",
          [
            id,
            owner,
            code,
            name,
            canonical,
            id === alt ? "alternate" : "standard",
          ],
        );
      }
      const save = async (
        id: string,
        name: string,
        cardId = leader,
        previous = "",
        format = "standard",
      ) => {
        await db.query("select save_deck($1)", [
          {
            id,
            name,
            leader_card_id: cardId,
            format,
            status: "draft",
            cards: [],
            expected_version_id: previous,
          },
        ]);
        return (
          await db.query("select current_version_id from decks where id=$1", [
            id,
          ])
        ).rows[0].current_version_id as string;
      };
      const v1 = await save(a, "Synthetic Alpha");
      const v2 = await save(a, "Synthetic Alpha", rival, v1);
      const vb = await save(b, "Synthetic Beta");
      const vbOther = await save(b, "Synthetic Beta", leader, vb, "other");
      await save(c, "Synthetic Empty");
      // Historical and current snapshots both belong to Alpha. Alternate rival art is one matchup.
      for (const [version, result, first, date, format, opponent] of [
        [v1, "win", true, "2026-01-01T12:00:00Z", "standard", rival],
        [v2, "win", false, "2026-01-02T12:00:00Z", "standard", alt],
        [v2, "loss", true, "2026-01-31T23:00:00Z", "standard", rival],
        [v2, "win", false, "2026-02-15T12:00:00Z", "standard", rival],
        [vb, "win", true, "2026-01-03T12:00:00Z", "standard", rival],
        [vbOther, "loss", false, "2026-01-04T12:00:00Z", "other", rival],
      ]) {
        await db.query(
          "insert into matches(user_id,deck_version_id,opponent_leader_id,result,went_first,played_at,format,match_type) values($1,$2,$3,$4,$5,$6,$7,'friendly')",
          [owner, version, opponent, result, first, date, format],
        );
      }
      await db.query("commit");
      // A different account's owned deck must never appear in selectors or comparisons.
      await db.query("begin");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        otherOwner,
      ]);
      await db.query("set local role authenticated");
      const foreignLeader = randomUUID();
      await db.query(
        "insert into cards(id,user_id,card_number,name,card_type,source,colors) values($1,$2,'OP93-003','Synthetic foreign leader','leader','manual','{red}')",
        [foreignLeader, otherOwner],
      );
      await db.query("select save_deck($1)", [
        {
          id: foreign,
          name: "Synthetic PRIVATE comparison",
          leader_card_id: foreignLeader,
          format: "standard",
          status: "draft",
          cards: [],
          expected_version_id: "",
        },
      ]);
      const foreignVersion = (
        await db.query("select current_version_id from decks where id=$1", [
          foreign,
        ])
      ).rows[0].current_version_id;
      await db.query(
        "insert into matches(user_id,deck_version_id,opponent_leader_id,result,went_first,format,match_type) values($1,$2,$3,'win',true,'standard','friendly')",
        [otherOwner, foreignVersion, foreignLeader],
      );
      await db.query("commit");
    } finally {
      await db.end();
    }
    await page.goto("/statistics");
    await expect(
      page.getByRole("heading", { name: "Resultados por versión" }),
    ).toHaveCount(0);
    await page.getByRole("link", { name: "Comparar dos mazos" }).click();
    await page.getByLabel("Mazo A", { exact: true }).selectOption(a);
    await page.getByLabel("Mazo B", { exact: true }).selectOption(b);
    await page.getByRole("button", { name: "Comparar resultados" }).click();
    const alpha = page.getByRole("region", {
        name: "Mazo A: Synthetic Alpha",
        exact: true,
      }),
      beta = page.getByRole("region", {
        name: "Mazo B: Synthetic Beta",
        exact: true,
      });
    await expect(alpha).toContainText("Victorias %75%");
    await expect(alpha).toContainText("Derrotas %25%");
    await expect(alpha).toContainText("4 partidas guardadas · n=4");
    await expect(beta).toContainText("Victorias %50%");
    await expect(beta).toContainText("2 partidas guardadas · n=2");
    await expect(
      page.getByLabel("Mazo A", { exact: true }).getByRole("option"),
    ).toHaveCount(4);
    await expect(page.locator("body")).not.toContainText("Synthetic PRIVATE");
    const opponents = page.getByRole("region", {
      name: "Comparación por líder rival",
      exact: true,
    });
    await expect(opponents.getByRole("row")).toHaveCount(2);
    await expect(opponents).toContainText("3 V · 1 D");
    await expect(opponents).not.toContainText("alternate");
    const orders = page.getByRole("region", {
      name: "Primero frente a segundo",
      exact: true,
    });
    await expect(orders.getByRole("row", { name: /Primero/ })).toContainText(
      "V 50% · D 50%",
    );
    const months = page.getByRole("region", {
      name: "Evolución mensual (Madrid)",
      exact: true,
    });
    await expect(months.getByRole("row", { name: /2026-01/ })).toContainText(
      "2 V · 0 D",
    );
    await expect(months.getByRole("row", { name: /2026-02/ })).toContainText(
      "1 V · 1 D",
    );
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "/tmp/pibardos-comparison-synthetic.png",
      fullPage: true,
    });
    await page.getByLabel("Formato común").selectOption("standard");
    await page.getByLabel("Desde (Madrid)").fill("2026-01-01");
    await page.getByLabel("Hasta (Madrid)").fill("2026-01-31");
    await page.getByRole("button", { name: "Comparar resultados" }).click();
    await expect(alpha).toContainText("2 partidas guardadas · n=2");
    await expect(alpha).toContainText("Victorias %100%");
    await expect(beta).toContainText("1 partidas guardadas · n=1");
    await page.goto(`/statistics/compare?a=${b}&b=${a}`);
    await expect(
      page.getByRole("region", { name: "Mazo A: Synthetic Beta", exact: true }),
    ).toContainText("Victorias %50%");
    await page.goto(`/statistics/compare?a=${a}&b=${c}`);
    const empty = page.getByRole("region", {
      name: "Mazo B: Synthetic Empty",
      exact: true,
    });
    await expect(empty).toContainText("Victorias %—");
    await expect(empty).toContainText("Derrotas %—");
    await expect(empty).toContainText("n=0");
    for (const query of [
      `a=${a}&b=${a}`,
      `a=${a}&b=${foreign}`,
      `a=invalid&b=${b}`,
      `a=${a}&a=${b}&b=${b}`,
      `a=${a}&b=${b}&from=2026-02-01&to=2026-01-01`,
    ]) {
      await page.goto(`/statistics/compare?${query}`);
      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: /Selecciona dos mazos|Revisa el formato/ }),
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: /^Mazo [AB]:/ }),
      ).toHaveCount(0);
      await expect(page.locator("body")).not.toContainText("Synthetic PRIVATE");
    }
    await page.goto(`/decks/${a}`);
    await page.getByRole("link", { name: "Comparar estadísticas" }).click();
    await expect(page.getByLabel("Mazo A", { exact: true })).toHaveValue(a);
    await page.goto(`/decks/${a}/compare`);
    await expect(page).toHaveURL(`/statistics/compare?a=${a}`);
    const anonymous = await browser.newContext();
    try {
      const anon = await anonymous.newPage();
      await anon.goto(`/statistics/compare?a=${a}&b=${b}`);
      await expect(anon).toHaveURL(/\/login/);
      await expect(anon.locator("body")).not.toContainText("Synthetic Alpha");
    } finally {
      await anonymous.close();
    }
    const verify = await connectLocalDatabase();
    try {
      expect(
        (
          await verify.query("select id from deck_versions where deck_id=$1", [
            a,
          ])
        ).rows,
      ).toHaveLength(2);
      expect(
        (
          await verify.query(
            "select m.id from matches m join deck_versions v on v.id=m.deck_version_id where v.deck_id=any($1::uuid[])",
            [[a, b, c]],
          )
        ).rows,
      ).toHaveLength(6);
    } finally {
      await verify.end();
    }
  } finally {
    await other.close();
    const db = await connectLocalDatabase();
    try {
      await db.query("delete from auth.users where email=any($1::text[])", [
        [email, otherEmail],
      ]);
    } finally {
      await db.end();
    }
  }
});

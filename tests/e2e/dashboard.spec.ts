import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { connectLocalDatabase } from "../helpers/local-database";

test("home switches saved leaders, preserves snapshot history and shows exact current curves on mobile", async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(10000);
  const email = `dashboard-${randomUUID()}@example.com`;
  const otherEmail = `dashboard-other-${randomUUID()}@example.com`;
  async function signup(target: typeof page, address: string) {
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
  }
  try {
    await signup(page, email);
    await expect(
      page.getByRole("heading", { name: "Tu estrategia empieza con un líder" }),
    ).toBeVisible();
    const global = page.getByRole("region", {
      name: "Resumen general",
      exact: true,
    });
    await expect(global).toContainText("n=0");
    await expect(global).not.toContainText("NaN");
    await expect(page.getByRole("button", { name: /^Ver líder / })).toHaveCount(
      0,
    );
    const db = await connectLocalDatabase();
    const ids = Array.from({ length: 8 }, () => randomUUID());
    const [a, alt, b, c, free, paid, unknown, don] = ids;
    let version2 = "";
    try {
      const owner = (
        await db.query("select id from auth.users where email=$1", [email])
      ).rows[0].id;
      await db.query("begin");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        owner,
      ]);
      await db.query("set local role authenticated");
      for (const [index, id] of ids.entries()) {
        await db.query(
          "insert into cards(id,user_id,card_number,name,card_type,source,language,colors,cost,printing_code,canonical_card_id) values($1,$2,$3,$4,$5,'manual','en','{red}',$6,$7,$8)",
          [
            id,
            owner,
            index === 7
              ? "DON!!"
              : `OP94-${String(index === 1 ? 1 : index + 1).padStart(3, "0")}`,
            [
              "Synthetic home Alpha",
              "Synthetic home Alpha alternate",
              "Synthetic home Beta",
              "Synthetic archived leader",
              "Synthetic free card",
              "Synthetic paid card",
              "Synthetic unknown cost",
              "Synthetic DON",
            ][index],
            index < 4 ? "leader" : index === 7 ? "don" : "character",
            index === 4 ? 0 : index === 5 ? 2 : null,
            index === 1 ? "alternate" : "standard",
            index === 1 ? a : id,
          ],
        );
      }
      async function save(
        name: string,
        leader: string,
        cards: unknown[],
        id = randomUUID(),
        previous = "",
      ) {
        await db.query("select save_deck($1)", [
          {
            id,
            expected_version_id: previous,
            name,
            leader_card_id: leader,
            format: "standard",
            status: "draft",
            cards,
          },
        ]);
        const version = (
          await db.query("select current_version_id from decks where id=$1", [
            id,
          ])
        ).rows[0].current_version_id;
        return { id, version };
      }
      const first = await save("Synthetic home Alpha deck", a, [
        { card_id: free, quantity: 4, role: "main" },
        { card_id: paid, quantity: 3, role: "main" },
        { card_id: unknown, quantity: 2, role: "main" },
        { card_id: don, quantity: 10, role: "don" },
      ]);
      const alternate = await save("Synthetic home alternate deck", alt, [
        { card_id: paid, quantity: 2, role: "main" },
      ]);
      const beta = await save("Synthetic home Beta deck", b, [
        { card_id: paid, quantity: 4, role: "main" },
      ]);
      const changed = await save("Synthetic changed leader deck", a, []);
      const archive = await save("Synthetic archived Alpha deck", a, []);
      const hidden = await save("Synthetic archived only deck", c, []);
      await db.query(
        "update decks set status='archived' where id=any($1::uuid[])",
        [[archive.id, hidden.id]],
      );
      await save(
        "Synthetic changed leader deck",
        b,
        [],
        changed.id,
        changed.version,
      );
      const second = await save(
        "Synthetic home Alpha deck",
        a,
        [
          { card_id: free, quantity: 4, role: "main" },
          { card_id: paid, quantity: 1, role: "main" },
          { card_id: unknown, quantity: 2, role: "main" },
          { card_id: don, quantity: 10, role: "don" },
        ],
        first.id,
        first.version,
      );
      version2 = second.version;
      for (const [version, result, wentFirst, time] of [
        [first.version, "win", true, "2026-09-01T12:00:00Z"],
        [second.version, "loss", false, "2026-10-02T12:00:00Z"],
        [beta.version, "loss", false, "2026-10-03T12:00:00Z"],
        [changed.version, "win", true, "2026-08-01T12:00:00Z"],
        [archive.version, "loss", false, "2026-10-01T12:00:00Z"],
      ])
        await db.query("select save_match($1)", [
          {
            id: randomUUID(),
            deck_version_id: version,
            opponent_leader_id: b,
            result,
            went_first: wentFirst,
            played_at: time,
            format: "standard",
            match_type: "casual",
            notes: "Synthetic dashboard fixture",
          },
        ]);
      await db.query("commit");
      // Merely displaying the dashboard must never rewrite these version snapshots.
      expect(
        (
          await db.query(
            "select sum(quantity)::int as quantity from deck_cards where deck_version_id=$1 and role='main'",
            [first.version],
          )
        ).rows[0].quantity,
      ).toBe(9);
      expect(alternate.version).not.toBe(second.version);
    } catch (error) {
      await db.query("rollback");
      throw error;
    } finally {
      await db.end();
    }
    await page.reload();
    await expect(page.getByRole("button", { name: /^Ver líder / })).toHaveCount(
      3,
    );
    await expect(
      page.getByRole("button", {
        name: /Ver líder.*Synthetic archived leader/,
      }),
    ).toHaveCount(1);
    const leader = page.getByRole("button", {
      name: /^Ver líder OP94-001 · Synthetic home Alpha(?: alternate)?$/,
    });
    await leader.click();
    await expect(leader).toHaveAttribute("aria-pressed", "true");
    const results = page.getByRole("region", {
      name: "Resultados del líder",
      exact: true,
    });
    await expect(results).toContainText("4 partidas guardadas");
    await expect(results).toContainText("50%");
    await expect(results).toContainText("n = 4");
    const playOrder = page.getByRole("region", {
      name: "Resultados por orden de salida",
      exact: true,
    });
    const firstOrder = playOrder.getByRole("region", {
      name: "Al ir primero",
      exact: true,
    });
    const secondOrder = playOrder.getByRole("region", {
      name: "Al ir segundo",
      exact: true,
    });
    await expect(firstOrder).toContainText("Victorias100%");
    await expect(firstOrder).toContainText("n=2");
    await expect(
      firstOrder.locator('.recharts-sector[fill="#4ade80"]'),
    ).toHaveCount(1);
    await expect(secondOrder).toContainText("Derrotas100%");
    await expect(secondOrder).toContainText("n=2");
    await expect(
      secondOrder.locator('.recharts-sector[fill="#f87171"]'),
    ).toHaveCount(1);
    await page
      .getByLabel("Mazo para la curva")
      .selectOption({ label: "Synthetic home Alpha deck · v2" });
    const curve = page.getByRole("region", {
      name: "Curva del mazo seleccionado",
      exact: true,
    });
    await expect(curve).toContainText("7/50 cartas");
    await expect(curve).toContainText("DON!! 10/10");
    await expect(
      curve
        .getByRole("list", { name: "Cantidades por coste" })
        .getByRole("listitem"),
    ).toHaveText(["Coste 0: 4", "Coste 2: 1", "Sin dato de coste: 2"]);
    const recent = page.getByRole("region", {
      name: "Últimas partidas",
      exact: true,
    });
    await expect(recent).toContainText("Synthetic changed leader deck · v1");
    await expect(recent).toContainText("Synthetic archived Alpha deck · v1");
    await expect(recent).not.toContainText("Synthetic home Beta deck");
    await expect(
      page.getByRole("link", { name: "Registrar partida", exact: true }),
    ).toHaveAttribute("href", `/matches/new?version=${version2}`);
    await page
      .getByLabel("Mazo para la curva")
      .selectOption({ label: "Synthetic home alternate deck · v1" });
    await expect(curve).toContainText("2/50 cartas");
    await expect(
      curve.getByRole("list", { name: "Cantidades por coste" }),
    ).toContainText("Coste 2: 2");
    await expect(results).toContainText("4 partidas guardadas");
    await page
      .getByRole("button", {
        name: "Ver líder OP94-003 · Synthetic home Beta",
        exact: true,
      })
      .click();
    await expect(results).toContainText("1 partida guardada");
    await expect(results).toContainText("n = 1");
    await expect(results).toContainText("0%");
    await expect(firstOrder).toContainText("n=0");
    await expect(firstOrder.locator(".recharts-surface")).toHaveCount(0);
    await expect(secondOrder).toContainText("n=1");
    await expect(secondOrder).toContainText("Derrotas100%");
    await expect(
      page.getByRole("region", { name: "Últimas partidas", exact: true }),
    ).not.toContainText("Synthetic changed leader deck · v1");
    await page
      .getByLabel("Mazo para la curva")
      .selectOption({ label: "Synthetic changed leader deck · v2" });
    await expect(curve).toContainText("0/50 cartas");
    await expect(curve).toContainText(
      "Este mazo aún no tiene cartas principales",
    );
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);
    }
    // A second real authenticated session cannot see the first owner's panel.
    const context = await browser.newContext();
    try {
      const other = await context.newPage();
      await signup(other, otherEmail);
      await expect(
        other.getByRole("heading", {
          name: "Tu estrategia empieza con un líder",
        }),
      ).toBeVisible();
      await expect(
        other.getByRole("button", { name: /^Ver líder / }),
      ).toHaveCount(0);
      await expect(
        other.getByRole("region", { name: "Resumen general" }),
      ).toContainText("n=0");
      await expect(other.getByText("Synthetic home Alpha")).toHaveCount(0);
    } finally {
      await context.close();
    }
  } finally {
    const cleanup = await connectLocalDatabase();
    try {
      await cleanup.query(
        "delete from auth.users where email=any($1::text[])",
        [[email, otherEmail]],
      );
    } finally {
      await cleanup.end();
    }
  }
});

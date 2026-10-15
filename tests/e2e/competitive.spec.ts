import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { connectLocalDatabase } from "../helpers/local-database";
test("mobile fifty-card import, exact-version match history, tournament rounds and real charts", async ({
  page,
}) => {
  test.setTimeout(120000);
  const email = `competitive-e2e-${randomUUID()}@example.com`,
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
    const db = await connectLocalDatabase();
    try {
      const user = (
        await db.query("select id from auth.users where email=$1", [email])
      ).rows[0];
      for (const [code, name, type, cost] of [
        ["OP95-001", "Synthetic player leader", "leader", null],
        ["OP95-002", "Synthetic rival leader", "leader", null],
        ...Array.from({ length: 13 }, (_, i) => [
          `OP95-${String(i + 10).padStart(3, "0")}`,
          `Synthetic main ${i + 1}`,
          "character",
          i % 5,
        ]),
      ]) {
        await db.query(
          "insert into cards(user_id,card_number,name,card_type,source,colors,cost) values($1,$2,$3,$4,'manual','{red}',$5)",
          [user.id, code, name, type, cost],
        );
      }
    } finally {
      await db.end();
    }
    const raw = [
      "1 OP95-001",
      ...Array.from(
        { length: 13 },
        (_, i) => `${i === 12 ? 2 : 4} OP95-${String(i + 10).padStart(3, "0")}`,
      ),
    ].join("\n");
    await page.goto("/decks/new");
    await page.getByText("Importar lista de texto", { exact: true }).click();
    await page.getByLabel("Lista de texto").fill(raw);
    await page.getByRole("button", { name: "Revisar importación" }).click();
    await expect(
      page.getByRole("heading", { name: "Mazo principal: 50 / 50" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continuar al nombre" }).click();
    await page
      .getByLabel("Nombre del mazo")
      .fill("Synthetic competitive mobile");
    await page
      .getByText("Opciones del mazo y nota de versión", { exact: true })
      .click();
    await page.getByLabel("Estado", { exact: true }).selectOption("active");
    await page.getByLabel(/He revisado las cantidades/).check();
    await page
      .getByRole("button", { name: "Guardar mazo", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Synthetic competitive mobile",
        exact: true,
      }),
    ).toBeVisible();
    const deckUrl = new URL(page.url()).pathname;
    await page
      .getByRole("link", { name: "Registrar partida", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Elegir líder rival", exact: true })
      .click();
    await page
      .getByLabel("Buscar líder rival", { exact: true })
      .fill("OP95-002");
    await page
      .getByRole("dialog", { name: "Elegir líder rival", exact: true })
      .getByRole("button", {
        name: "Elegir rival OP95-002 · Synthetic rival leader",
        exact: true,
      })
      .click();
    await page.getByLabel("Victoria", { exact: true }).check();
    await page.getByLabel("Primero", { exact: true }).check();
    await page
      .getByRole("button", { name: "Guardar partida", exact: true })
      .click();
    await expect(page).toHaveURL(/\/matches\?saved=1/);
    await expect(
      page.getByText("Synthetic competitive mobile · v1 · Primero", {
        exact: true,
      }),
    ).toBeVisible();
    await page.goto("/statistics");
    const firstOnly = page.getByRole("region", {
      name: "Al ir primero",
      exact: true,
    });
    await expect(firstOnly).toContainText("Victorias100%");
    await expect(firstOnly).toContainText("Derrotas0%");
    await expect(firstOnly).toContainText("n=1");
    const noSecond = page.getByRole("region", {
      name: "Al ir segundo",
      exact: true,
    });
    await expect(noSecond).toContainText("Victorias—");
    await expect(noSecond).toContainText("Derrotas—");
    await expect(noSecond).toContainText("n=0");
    await page.goto(`${deckUrl}/edit`);
    await page.getByRole("button", { name: "Quitar una OP95-010" }).click();
    await page.getByLabel("Estado", { exact: true }).selectOption("draft");
    await page
      .getByRole("button", { name: "Guardar mazo", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${deckUrl}\\?saved=1`));
    await page
      .getByRole("link", { name: "Registrar partida", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Elegir líder rival", exact: true })
      .click();
    await page
      .getByLabel("Buscar líder rival", { exact: true })
      .fill("OP95-002");
    await page
      .getByRole("dialog", { name: "Elegir líder rival", exact: true })
      .getByRole("button", {
        name: "Elegir rival OP95-002 · Synthetic rival leader",
        exact: true,
      })
      .click();
    await page.getByLabel("Derrota", { exact: true }).check();
    await page.getByLabel("Segundo", { exact: true }).check();
    await page
      .getByRole("button", { name: "Guardar partida", exact: true })
      .click();
    await expect(
      page.getByText("Synthetic competitive mobile · v2 · Segundo", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Synthetic competitive mobile · v1 · Primero", {
        exact: true,
      }),
    ).toBeVisible();
    await page.goto("/tournaments/new");
    await page.getByLabel("Nombre del torneo").fill("Synthetic mobile event");
    await page
      .getByLabel("Mazo y versión del torneo")
      .selectOption({ label: "Synthetic competitive mobile · v1 · standard" });
    await page
      .getByRole("button", { name: "Crear torneo", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Synthetic mobile event",
        exact: true,
      }),
    ).toBeVisible();
    const eventUrl = new URL(page.url()).pathname;
    await page
      .getByRole("link", { name: "Registrar ronda", exact: true })
      .click();
    await expect(page.getByLabel("Número de ronda")).toHaveValue("1");
    await page
      .getByRole("button", { name: "Elegir líder rival", exact: true })
      .click();
    await page
      .getByLabel("Buscar líder rival", { exact: true })
      .fill("OP95-002");
    await page
      .getByRole("dialog", { name: "Elegir líder rival", exact: true })
      .getByRole("button", {
        name: "Elegir rival OP95-002 · Synthetic rival leader",
        exact: true,
      })
      .click();
    await page.getByLabel("Victoria", { exact: true }).check();
    await page.getByLabel("Primero", { exact: true }).check();
    await page
      .getByRole("button", { name: "Guardar partida", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Ronda 1 · Victoria", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Editar partida", exact: true })
      .click();
    await page.getByLabel("Derrota", { exact: true }).check();
    await page.getByLabel("Segundo", { exact: true }).check();
    await page
      .getByRole("button", { name: "Guardar cambios de partida", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Ronda 1 · Derrota", exact: true }),
    ).toBeVisible();
    await page.goto("/statistics");
    await expect(
      page.getByText(
        "3 partidas · 3 victorias o derrotas para el porcentaje.",
        { exact: false },
      ),
    ).toBeVisible();
    const order = page.getByRole("region", {
      name: "Primero frente a segundo",
      exact: true,
    });
    await expect(
      order.getByRole("row").filter({ hasText: "Primero" }),
    ).toContainText("100%");
    await expect(
      order.getByRole("row").filter({ hasText: "Segundo" }),
    ).toContainText("0%");
    const second = order.getByRole("region", {
      name: "Al ir segundo",
      exact: true,
    });
    await expect(second).toContainText("Victorias0%");
    await expect(second).toContainText("Derrotas100%");
    await expect(second).toContainText("n=2");
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(second).toContainText("Derrotas100%");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    await order.screenshot({ path: "/tmp/pibardos-play-order-synthetic.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(second).toContainText("Muestra pequeña");
    await page
      .getByLabel("Mazo para las gráficas")
      .selectOption(deckUrl.split("/").at(-1)!);
    await page.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect(second).toContainText("Derrotas100%");
    await expect(second).toContainText("n=2");
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: "Synthetic competitive mobile" })
        .filter({ hasText: "Muestra pequeña" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.goto(`${eventUrl}/edit`);
    await page.getByLabel("Posición final (opcional)").fill("2");
    await page
      .getByRole("button", { name: "Guardar torneo", exact: true })
      .click();
    await expect(
      page.getByText("Puesto final: 2", { exact: true }),
    ).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Archivar torneo", exact: true })
      .click();
    await expect(
      page.getByText("EVENTO ARCHIVADO", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Registrar ronda", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Ronda 1 · Derrota", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Editar partida", exact: true })
      .click();
    await page.getByLabel("Victoria", { exact: true }).check();
    await page
      .getByRole("button", { name: "Guardar cambios de partida", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Ronda 1 · Victoria", exact: true }),
    ).toBeVisible();
    await page.goto("/statistics");
    await expect(
      page.getByText(
        "3 partidas · 3 victorias o derrotas para el porcentaje.",
        { exact: false },
      ),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Resultados por mazo", exact: true })
        .getByRole("cell")
        .filter({ hasText: "66,7%" }),
    ).toBeVisible();
    const updatedSecond = page.getByRole("region", {
      name: "Al ir segundo",
      exact: true,
    });
    await expect(updatedSecond).toContainText("Victorias50%");
    await expect(updatedSecond).toContainText("Derrotas50%");
    await expect(updatedSecond).toContainText("n=2");
    await page.goto("/matches");
    const loss = page
      .getByRole("listitem")
      .filter({ hasText: "Synthetic competitive mobile · v2 · Segundo" });
    await loss
      .getByRole("link", { name: "Editar partida", exact: true })
      .click();
    page.once("dialog", (dialog) => dialog.dismiss());
    await page
      .getByRole("button", { name: "Eliminar partida", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Editar partida", exact: true }),
    ).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Eliminar partida", exact: true })
      .click();
    await expect(page).toHaveURL(/\/matches\?saved=1/);
    await expect(
      page.getByText("Synthetic competitive mobile · v2 · Segundo", {
        exact: true,
      }),
    ).toHaveCount(0);
    await page.goto("/statistics");
    await expect(
      page.getByText(
        "2 partidas · 2 victorias o derrotas para el porcentaje.",
        { exact: false },
      ),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Resultados por mazo", exact: true })
        .getByRole("cell")
        .filter({ hasText: "100%" }),
    ).toBeVisible();
    const verify = await connectLocalDatabase();
    try {
      const user = (
        await verify.query("select id from auth.users where email=$1", [email])
      ).rows[0];
      const saved = (
        await verify.query(
          "select m.result,m.went_first,v.version_number from matches m join deck_versions v on v.id=m.deck_version_id where m.user_id=$1 order by m.created_at",
          [user.id],
        )
      ).rows;
      expect(saved).toEqual([
        { result: "win", went_first: true, version_number: 1 },
        { result: "win", went_first: false, version_number: 1 },
      ]);
      expect(
        (
          await verify.query(
            "select quantity from deck_cards where deck_version_id in (select id from deck_versions where user_id=$1 and version_number=1) order by card_id",
            [user.id],
          )
        ).rows.reduce((n, row) => n + row.quantity, 0),
      ).toBe(50);
    } finally {
      await verify.end();
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

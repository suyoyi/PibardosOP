import { it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { connectLocalDatabase } from "../helpers/local-database";
import { suFanCard } from "../fixtures/fan-cards";

it("installs the current cloud bundle transactionally, records migration history and rejects an existing database without losing data", async () => {
  execFileSync(
    process.execPath,
    ["scripts/build-cloud-bootstrap.mjs", "--check"],
    { stdio: "pipe" },
  );
  const sql = readFileSync("supabase/cloud-bootstrap.sql", "utf8");
  const expectedVersions = readdirSync("supabase/migrations")
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => file.slice(0, 14));
  const name = `pibardos_migrations_bootstrap${randomUUID().replaceAll("-", "")}`;
  const admin = await connectLocalDatabase();
  let created = false;
  try {
    await admin.query(`create database ${name}`);
    created = true;
    const fresh = await connectLocalDatabase(name);
    try {
      await fresh.query(
        "create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;",
      );
      await expect(
        fresh.query(sql.replace("\nCOMMIT;", "\nSELECT 1/0;\nCOMMIT;")),
      ).rejects.toMatchObject({ code: "22012" });
      await fresh.query("rollback");
      expect(
        (
          await fresh.query(
            "select count(*)::int as count from pg_tables where schemaname='public'",
          )
        ).rows[0].count,
      ).toBe(0);
      expect(
        (
          await fresh.query(
            "select to_regclass('supabase_migrations.schema_migrations') as relation",
          )
        ).rows[0].relation,
      ).toBeNull();

      await fresh.query(sql);
      expect(
        (
          await fresh.query(
            "select version from supabase_migrations.schema_migrations order by version",
          )
        ).rows.map((row) => row.version),
      ).toEqual(expectedVersions);
      const tables = (
        await fresh.query(
          "select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'",
        )
      ).rows;
      expect(tables).toHaveLength(17);
      expect(tables.every((table) => table.relrowsecurity)).toBe(true);
      expect(
        (await fresh.query("select count(*)::int as count from fan_cards"))
          .rows[0].count,
      ).toBe(7);
      expect(
        (
          await fresh.query(
            "select count(*)::int as count from fan_card_variants",
          )
        ).rows[0].count,
      ).toBe(1);
      const owner = randomUUID();
      await fresh.query("insert into auth.users(id) values($1)", [owner]);
      await fresh.query(
        "insert into fan_card_unlocks(user_id,fan_card_id) values($1,$2)",
        [owner, suFanCard.id],
      );
      await expect(fresh.query(sql)).rejects.toThrow(
        "requires an empty public schema",
      );
      await fresh.query("rollback");
      expect(
        (await fresh.query("select user_id,fan_card_id from fan_card_unlocks"))
          .rows,
      ).toEqual([{ user_id: owner, fan_card_id: suFanCard.id }]);
      await fresh.query("begin; set local role anon");
      await expect(
        fresh.query("select * from supabase_migrations.schema_migrations"),
      ).rejects.toMatchObject({ code: "42501" });
      await fresh.query("rollback");
    } finally {
      await fresh.end();
    }
  } finally {
    if (created) await admin.query(`drop database ${name} with (force)`);
    await admin.end();
  }
}, 20000);

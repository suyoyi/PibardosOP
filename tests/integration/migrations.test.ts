import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { connectLocalDatabase } from "../helpers/local-database";
it("replays every application migration in a fresh disposable PostgreSQL database", async () => {
  const name = `pibardos_migrations_${randomUUID().replaceAll("-", "")}`,
    admin = await connectLocalDatabase();
  let created = false;
  try {
    await admin.query(`create database ${name}`);
    created = true;
    const fresh = await connectLocalDatabase(name);
    try {
      // Supabase supplies these Auth objects before application migrations. A
      // minimal fixture tests the complete application SQL from an empty schema.
      await fresh.query(
        "create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;",
      );
      for (const file of readdirSync("supabase/migrations")
        .filter((f) => f.endsWith(".sql") && !f.endsWith("_match_results.sql"))
        .sort())
        await fresh.query(readFileSync(`supabase/migrations/${file}`, "utf8"));
      const tables = (
        await fresh.query(
          "select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r'",
        )
      ).rows;
      expect(tables).toHaveLength(13);
      expect(tables.every((t) => t.relrowsecurity)).toBe(true);
      const owner = randomUUID(),
        leader = randomUUID(),
        card = randomUUID(),
        deck = randomUUID();
      await fresh.query("begin");
      await fresh.query("insert into auth.users(id) values($1)", [owner]);
      await fresh.query("select set_config('request.jwt.claim.sub',$1,true)", [
        owner,
      ]);
      await fresh.query("set local role authenticated");
      for (const [id, number, type] of [
        [leader, "OP94-001", "leader"],
        [card, "OP94-002", "character"],
      ])
        await fresh.query(
          "insert into cards(id,user_id,card_number,name,card_type,source,colors) values($1,$2,$3,'Synthetic migration fixture',$4,'manual','{red}')",
          [id, owner, number, type],
        );
      await fresh.query("select save_deck($1)", [
        {
          id: deck,
          name: "Synthetic migration deck",
          expected_version_id: "",
          leader_card_id: leader,
          format: "standard",
          status: "draft",
          cards: [{ card_id: card, quantity: 4, role: "main" }],
        },
      ]);
      const snapshot = (
        await fresh.query(
          "select id,change_summary from deck_versions where deck_id=$1",
          [deck],
        )
      ).rows[0];
      expect(snapshot.change_summary.cards).toEqual([
        {
          card_id: card,
          before: 0,
          after: 4,
          before_role: null,
          after_role: "main",
        },
      ]);
      await fresh.query("select save_match($1)", [
        {
          id: randomUUID(),
          deck_version_id: snapshot.id,
          opponent_leader_id: leader,
          result: "draw",
          went_first: true,
          played_at: "2026-01-01T12:00:00Z",
          format: "standard",
          match_type: "friendly",
          tournament_id: "",
          round_number: "",
          notes: "",
        },
      ]);
      await fresh.query("commit");
      // Apply the new outcome guard to a real pre-migration historical row.
      await fresh.query("reset role");
      await fresh.query(
        readFileSync(
          "supabase/migrations/20261014000400_match_results.sql",
          "utf8",
        ),
      );
      await fresh.query("begin");
      await fresh.query("select set_config('request.jwt.claim.sub',$1,true)", [
        owner,
      ]);
      await fresh.query("set local role authenticated");
      const legacy = (
        await fresh.query("select id,result from matches where user_id=$1", [
          owner,
        ])
      ).rows[0];
      expect(legacy.result).toBe("draw");
      await fresh.query(
        "update matches set notes='Historical record retained' where id=$1",
        [legacy.id],
      );
      await fresh.query("savepoint unsupported");
      await expect(
        fresh.query(
          "insert into matches(deck_version_id,opponent_leader_id,result,went_first,format,match_type) values($1,$2,'draw',true,'standard','friendly')",
          [snapshot.id, leader],
        ),
      ).rejects.toThrow("Only win or loss");
      await fresh.query("rollback to savepoint unsupported");
      await fresh.query("update matches set result='loss' where id=$1", [
        legacy.id,
      ]);
      expect(
        (
          await fresh.query("select result from matches where id=$1", [
            legacy.id,
          ])
        ).rows[0].result,
      ).toBe("loss");
      await fresh.query("commit");
      // Account cascade must remove private cards, decks, snapshots and games together.
      await fresh.query("reset role");
      await fresh.query("delete from auth.users where id=$1", [owner]);
      expect(
        (await fresh.query("select id from cards where user_id=$1", [owner]))
          .rows,
      ).toEqual([]);
      expect(
        (await fresh.query("select id from matches where user_id=$1", [owner]))
          .rows,
      ).toEqual([]);
    } finally {
      await fresh.end();
    }
  } finally {
    if (created) await admin.query(`drop database ${name} with (force)`);
    await admin.end();
  }
}, 20000);

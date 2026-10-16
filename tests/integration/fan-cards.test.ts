import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { connectLocalDatabase } from "../helpers/local-database";
import { fanCardFixtures } from "../fixtures/fan-cards";

it.each(fanCardFixtures)(
  "$card.name: shares the separate fan catalog with signed-in friends, denies writes/anonymous reads and excludes playable identities",
  async ({ card }) => {
    const db = await connectLocalDatabase();
    const asUser = async (id: string, role = "authenticated") => {
      await db.query("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        id,
      ]);
      await db.query(
        role === "anon"
          ? "set local role anon"
          : "set local role authenticated",
      );
    };
    const denies = async (sql: string, params: unknown[] = []) => {
      await db.query("savepoint denied_fan_access");
      let denied = false;
      try {
        await db.query(sql, params);
      } catch {
        denied = true;
      }
      await db.query("rollback to savepoint denied_fan_access");
      expect(denied).toBe(true);
    };
    try {
      await db.query("begin");
      await asUser("", "anon");
      await denies("select * from fan_cards");
      await asUser("");
      expect((await db.query("select id from fan_cards")).rows).toEqual([]);
      for (const user of [randomUUID(), randomUUID()]) {
        await asUser(user);
        const row = (
          await db.query("select * from fan_cards where id=$1", [card.id])
        ).rows[0];
        expect(row).toMatchObject({
          id: card.id,
          name: card.name,
          display_number: card.display_number,
          edition_code: card.edition_code,
          artwork_id: card.artwork_id,
        });
        expect(
          (await db.query("select id from cards where id=$1", [card.id])).rows,
        ).toEqual([]);
        await denies("update fan_cards set name='Forged' where id=$1", [
          card.id,
        ]);
        await denies("delete from fan_cards where id=$1", [card.id]);
        await denies(
          "insert into fan_cards(id,name,edition_code,artwork_id) values($1,'Forged','fan-pirate-gods','forged')",
          [randomUUID()],
        );
      }
    } finally {
      await db.query("rollback");
      await db.end();
    }
  },
);

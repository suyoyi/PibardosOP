import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { connectLocalDatabase } from "../helpers/local-database";
import { vinFanCard } from "../fixtures/fan-cards";

it("shares the separate fan catalog with signed-in friends, denies writes/anonymous reads and excludes playable identities", async () => {
  const db = await connectLocalDatabase();
  const asUser = async (id: string, role = "authenticated") => {
    await db.query("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
    await db.query(
      role === "anon" ? "set local role anon" : "set local role authenticated",
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
        await db.query("select * from fan_cards where id=$1", [vinFanCard.id])
      ).rows[0];
      expect(row).toMatchObject({
        id: vinFanCard.id,
        name: vinFanCard.name,
        display_number: "OP-001",
        edition_code: vinFanCard.edition_code,
        artwork_id: vinFanCard.artwork_id,
      });
      expect(
        (await db.query("select id from cards where id=$1", [vinFanCard.id]))
          .rows,
      ).toEqual([]);
      await denies("update fan_cards set name='Forged' where id=$1", [
        vinFanCard.id,
      ]);
      await denies("delete from fan_cards where id=$1", [vinFanCard.id]);
      await denies(
        "insert into fan_cards(id,name,edition_code,artwork_id) values($1,'Forged','fan-pirate-gods','forged')",
        [randomUUID()],
      );
    }
  } finally {
    await db.query("rollback");
    await db.end();
  }
});

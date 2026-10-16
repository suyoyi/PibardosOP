import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { connectLocalDatabase } from "../helpers/local-database";
import { suFanCard, marioFanCard } from "../fixtures/fan-cards";

it("persists idempotent fan discoveries per account, denies cross-account writes and prevents relocking", async () => {
  const db = await connectLocalDatabase();
  const owner = randomUUID(),
    other = randomUUID();
  const asUser = async (id: string, role = "authenticated") => {
    await db.query("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
    await db.query(
      role === "anon" ? "set local role anon" : "set local role authenticated",
    );
  };
  const denies = async (
    sql: string,
    params: unknown[] = [],
    code = "42501",
  ) => {
    await db.query("savepoint denied_unlock");
    await expect(db.query(sql, params)).rejects.toMatchObject({ code });
    await db.query("rollback to savepoint denied_unlock");
  };
  try {
    await db.query("begin");
    await db.query("insert into auth.users(id) values($1),($2)", [
      owner,
      other,
    ]);
    await asUser("", "anon");
    await denies("select * from fan_card_unlocks");
    await denies("insert into fan_card_unlocks(fan_card_id) values($1)", [
      suFanCard.id,
    ]);
    await asUser("");
    expect((await db.query("select * from fan_card_unlocks")).rows).toEqual([]);
    await denies(
      "insert into fan_card_unlocks(user_id,fan_card_id) values($1,$2)",
      [owner, suFanCard.id],
    );
    await asUser(owner);
    await denies(
      "insert into fan_card_unlocks(user_id,fan_card_id) values($1,$2)",
      [other, suFanCard.id],
    );
    await denies(
      "insert into fan_card_unlocks(fan_card_id) values($1)",
      [randomUUID()],
      "23503",
    );
    for (let attempt = 0; attempt < 2; attempt++)
      await db.query(
        "insert into fan_card_unlocks(user_id,fan_card_id) values($1,$2) on conflict(user_id,fan_card_id) do nothing",
        [owner, suFanCard.id],
      );
    const saved = (await db.query("select * from fan_card_unlocks")).rows;
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      user_id: owner,
      fan_card_id: suFanCard.id,
    });
    await denies("update fan_card_unlocks set fan_card_id=$1", [
      marioFanCard.id,
    ]);
    await denies("delete from fan_card_unlocks where fan_card_id=$1", [
      suFanCard.id,
    ]);
    await denies(
      "insert into fan_card_unlocks(user_id,fan_card_id,unlocked_at) values($1,$2,now())",
      [owner, marioFanCard.id],
    );
    await asUser(other);
    expect((await db.query("select * from fan_card_unlocks")).rows).toEqual([]);
    await db.query("insert into fan_card_unlocks(fan_card_id) values($1)", [
      marioFanCard.id,
    ]);
    expect(
      (await db.query("select fan_card_id from fan_card_unlocks")).rows,
    ).toEqual([{ fan_card_id: marioFanCard.id }]);
    await asUser(owner);
    expect((await db.query("select * from fan_card_unlocks")).rows).toEqual(
      saved,
    );
    await db.query("reset role");
    await db.query("delete from auth.users where id=$1", [owner]);
    expect(
      (
        await db.query("select * from fan_card_unlocks where user_id=$1", [
          owner,
        ])
      ).rows,
    ).toEqual([]);
    expect(
      (
        await db.query("select * from fan_card_unlocks where user_id=$1", [
          other,
        ])
      ).rows,
    ).toHaveLength(1);
  } finally {
    await db.query("rollback");
    await db.end();
  }
});

import { randomUUID } from "node:crypto";
import { it, expect } from "vitest";
import { connectLocalDatabase } from "../helpers/local-database";
import { normalizeOptcgCard } from "../../src/domain/optcg";
import { optcgRecord } from "../fixtures/optcg";
it("keeps provider facts immutable, separates alternate printings, refreshes quotes and enforces private ownership", async () => {
  const db = await connectLocalDatabase(),
    owner = randomUUID(),
    other = randomUUID();
  async function user(id: string) {
    await db.query("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
    await db.query("set local role authenticated");
  }
  async function rejects(sql: string, params: unknown[] = []) {
    await db.query("savepoint invalid_call");
    let rejected = false;
    try {
      await db.query(sql, params);
    } catch {
      rejected = true;
    }
    await db.query("rollback to savepoint invalid_call");
    expect(rejected).toBe(true);
  }
  try {
    await db.query("begin");
    await db.query("insert into auth.users(id,email) values($1,$2),($3,$4)", [
      owner,
      `${owner}@example.invalid`,
      other,
      `${other}@example.invalid`,
    ]);
    await user(owner);
    const original = normalizeOptcgCard(optcgRecord(), "sets"),
      alternate = normalizeOptcgCard(
        optcgRecord({ card_image_id: "OP97-010_p1" }),
        "sets",
      );
    const save = async (card: unknown) =>
      (await db.query("select cache_optcg_card($1) as id", [card])).rows[0]
        .id as string;
    const a = await save(original),
      b = await save(alternate);
    expect(a).not.toBe(b);
    const rows = (
      await db.query(
        "select id,canonical_card_id,provider_card_id from cards where id=any($1)",
        [[a, b]],
      )
    ).rows;
    expect(rows.every((c) => c.canonical_card_id === a)).toBe(true);
    const leader = (
      await db.query(
        "insert into cards(user_id,card_number,name,card_type,colors,source) values($1,'OP97-001','Synthetic leader','leader','{red}','manual') returning id",
        [owner],
      )
    ).rows[0].id;
    const deck = randomUUID();
    await db.query("select save_deck($1)", [
      {
        id: deck,
        name: "Synthetic provider deck",
        expected_version_id: "",
        leader_card_id: leader,
        format: "standard",
        status: "draft",
        cards: [{ card_id: a, quantity: 4, role: "main" }],
      },
    ]);
    const version = (
      await db.query("select id from deck_versions where deck_id=$1", [deck])
    ).rows[0].id;
    expect(
      await save({
        ...original,
        name: "Changed upstream name",
        power: 9999,
        prices: [{ currency: null, metric: "market_price", amount: 4 }],
      }),
    ).toBe(a);
    expect(
      (await db.query("select name,power from cards where id=$1", [a])).rows[0],
    ).toEqual({ name: original.name, power: 5000 });
    expect(
      (
        await db.query("select prices from optcg_card_items where card_id=$1", [
          a,
        ])
      ).rows[0].prices[0].amount,
    ).toBe(4);
    expect(
      (
        await db.query(
          "select card_id,quantity from deck_cards where deck_version_id=$1",
          [version],
        )
      ).rows,
    ).toEqual([{ card_id: a, quantity: 4 }]);
    await rejects("update optcg_card_items set prices='[]' where card_id=$1", [
      a,
    ]);
    await rejects(
      "insert into cards(user_id,card_number,name,card_type,source) values($1,'OP97-099','Spoof','character','optcgapi')",
      [owner],
    );
    await user(other);
    expect(
      (
        await db.query(
          "select card_id from optcg_card_items where card_id=any($1)",
          [[a, b]],
        )
      ).rows,
    ).toEqual([]);
    expect(
      (await db.query("select id from cards where id=any($1)", [[a, b]])).rows,
    ).toEqual([]);
    const own = await save({ ...original, user_id: owner, card_id: a });
    expect(own).not.toBe(a);
    expect(
      (
        await db.query(
          "select user_id from optcg_card_items where card_id=$1",
          [own],
        )
      ).rows[0].user_id,
    ).toBe(other);
    await rejects("select save_deck($1)", [
      {
        id: randomUUID(),
        name: "Cross owner",
        expected_version_id: "",
        leader_card_id: leader,
        format: "standard",
        status: "draft",
        cards: [{ card_id: a, quantity: 4, role: "main" }],
      },
    ]);
    await db.query("reset role");
    await db.query("delete from auth.users where id=$1", [owner]);
    expect(
      (
        await db.query(
          "select card_id from optcg_card_items where user_id=$1",
          [owner],
        )
      ).rows,
    ).toEqual([]);
    await db.query("set local role anon");
    await rejects("select cache_optcg_card($1)", [original]);
  } finally {
    await db.query("rollback");
    await db.end();
  }
});

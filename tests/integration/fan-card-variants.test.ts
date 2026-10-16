import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { connectLocalDatabase } from "../helpers/local-database";
import { suFanCard, suAlternateVariant } from "../fixtures/fan-cards";

it("keeps an authenticated read-only alternate illustration under the original fan card and enforces its parent reference", async () => {
  const db = await connectLocalDatabase();
  const denies = async (sql: string, params: unknown[] = [], code?: string) => {
    await db.query("savepoint denied_variant_access");
    let failure: unknown;
    try {
      await db.query(sql, params);
    } catch (e) {
      failure = e;
    }
    await db.query("rollback to savepoint denied_variant_access");
    expect(failure).toBeDefined();
    if (code) expect(failure).toMatchObject({ code });
  };
  const asUser = async (id: string, role = "authenticated") => {
    await db.query("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
    await db.query(
      role === "anon" ? "set local role anon" : "set local role authenticated",
    );
  };
  try {
    await db.query("begin");
    await denies(
      "insert into fan_card_variants(fan_card_id,artwork_id,label) values($1,'unknown-parent','Unknown')",
      [randomUUID()],
      "23503",
    );
    await asUser("", "anon");
    await denies("select * from fan_card_variants", [], "42501");
    await asUser("");
    expect((await db.query("select * from fan_card_variants")).rows).toEqual(
      [],
    );
    for (const user of [randomUUID(), randomUUID()]) {
      await asUser(user);
      const rows = (
        await db.query("select * from fan_card_variants where fan_card_id=$1", [
          suFanCard.id,
        ])
      ).rows;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        fan_card_id: suFanCard.id,
        artwork_id: suAlternateVariant.artwork_id,
        label: suAlternateVariant.label,
      });
      expect(
        (
          await db.query(
            "select id,artwork_id from fan_cards where display_number='LDP-007'",
          )
        ).rows,
      ).toEqual([{ id: suFanCard.id, artwork_id: suFanCard.artwork_id }]);
      expect(
        (
          await db.query("select id from fan_cards where artwork_id=$1", [
            suAlternateVariant.artwork_id,
          ])
        ).rows,
      ).toEqual([]);
      await denies(
        "update fan_card_variants set label='Forged' where fan_card_id=$1",
        [suFanCard.id],
        "42501",
      );
      await denies(
        "delete from fan_card_variants where fan_card_id=$1",
        [suFanCard.id],
        "42501",
      );
      await denies(
        "insert into fan_card_variants(fan_card_id,artwork_id,label) values($1,'forged','Forged')",
        [suFanCard.id],
        "42501",
      );
    }
  } finally {
    await db.query("rollback");
    await db.end();
  }
});

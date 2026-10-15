import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { customArtworks } from "../../src/domain/custom-artworks";
import { connectLocalDatabase } from "../helpers/local-database";
it("shares read-only custom art with canonical rules, preserves played snapshots and isolates each friend's deck", async () => {
  const db = await connectLocalDatabase(),
    owner = randomUUID(),
    other = randomUUID(),
    deck = randomUUID(),
    art = customArtworks[0];
  const asUser = async (id: string) => {
    await db.query("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
    await db.query("set local role authenticated");
  };
  async function rejects(sql: string, params: unknown[]) {
    await db.query("savepoint rejected_art_write");
    let rejected = false;
    try {
      await db.query(sql, params);
    } catch {
      rejected = true;
    }
    await db.query("rollback to savepoint rejected_art_write");
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
    await asUser(owner);
    const cards = (
      await db.query("select * from cards where id=any($1::uuid[])", [
        [art.cardId, art.canonicalCardId],
      ])
    ).rows;
    const custom = cards.find((c) => c.id === art.cardId),
      base = cards.find((c) => c.id === art.canonicalCardId);
    expect(cards).toHaveLength(2);
    expect(custom).toMatchObject({
      user_id: null,
      name: art.name,
      card_number: art.cardNumber,
      canonical_card_id: base.id,
      printing_code: art.printingCode,
      source: "custom-artwork",
      image_url: null,
    });
    for (const field of [
      "card_type",
      "colors",
      "cost",
      "power",
      "counter",
      "life",
      "attribute",
      "traits",
      "effect_text",
      "set_code",
      "rarity",
      "language",
    ])
      expect(custom[field]).toEqual(base[field]);
    await rejects("update cards set power=99999 where id=$1", [art.cardId]);
    await rejects("delete from cards where id=$1", [art.cardId]);
    await rejects(
      "insert into cards(user_id,card_number,name,card_type,source,colors) values($1,'OP12-020','Forged shared art','leader','custom-artwork','{green}')",
      [owner],
    );
    const save = async (leader: string, previous = "") => {
      await db.query("select save_deck($1)", [
        {
          id: deck,
          name: "Synthetic custom art deck",
          leader_card_id: leader,
          format: "standard",
          status: "draft",
          cards: [],
          expected_version_id: previous,
        },
      ]);
      return (
        await db.query("select current_version_id from decks where id=$1", [
          deck,
        ])
      ).rows[0].current_version_id;
    };
    const first = await save(art.cardId);
    await db.query(
      "insert into matches(user_id,deck_version_id,opponent_leader_id,result,went_first,format,match_type) values($1,$2,$3,'win',true,'standard','friendly')",
      [owner, first, base.id],
    );
    await save(base.id, first);
    expect(
      (
        await db.query("select leader_card_id from deck_versions where id=$1", [
          first,
        ])
      ).rows[0].leader_card_id,
    ).toBe(art.cardId);
    expect(
      (
        await db.query("select deck_version_id from matches where user_id=$1", [
          owner,
        ])
      ).rows[0].deck_version_id,
    ).toBe(first);
    await asUser(other);
    expect(
      (await db.query("select id from cards where id=$1", [art.cardId])).rows,
    ).toHaveLength(1);
    expect(
      (await db.query("select id from decks where id=$1", [deck])).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select id from deck_versions where deck_id=$1", [deck]))
        .rows,
    ).toHaveLength(0);
    await rejects("select save_deck($1)", [
      {
        id: deck,
        name: "Other account",
        leader_card_id: art.cardId,
        expected_version_id: "",
        cards: [],
      },
    ]);
  } finally {
    await db.query("rollback");
    await db.end();
  }
});

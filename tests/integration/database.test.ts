import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { connectLocalDatabase } from "../helpers/local-database";

describe("PostgreSQL ownership and snapshot integrity", () => {
  let db: Client;
  const owner = randomUUID(),
    other = randomUUID();
  let leader: string,
    card: string,
    alternate: string,
    deck: string,
    otherDeck: string,
    version: string,
    tournament: string,
    match: string,
    inventory: string;
  async function asUser(id: string) {
    await db.query("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
    await db.query("set local role authenticated");
  }
  async function rejects(query: string, values: unknown[] = []) {
    await db.query("savepoint rejected_operation");
    let rejected = false;
    try {
      await db.query(query, values);
    } catch {
      rejected = true;
    }
    await db.query("rollback to savepoint rejected_operation");
    expect(rejected).toBe(true);
  }
  beforeAll(async () => {
    db = await connectLocalDatabase();
    await db.query("begin");
    await db.query("insert into auth.users(id,email) values ($1,$2),($3,$4)", [
      owner,
      `${owner}@example.invalid`,
      other,
      `${other}@example.invalid`,
    ]);
    const insertCard = async (
      number: string,
      type: string,
      canonical?: string,
    ) =>
      (
        await db.query(
          "insert into public.cards(card_number,name,card_type,source,canonical_card_id,printing_code) values($1,'Synthetic test fixture',$2,'test-fixture',$3,$4) returning id",
          [
            number,
            type,
            canonical ?? null,
            canonical ? "alternate" : "standard",
          ],
        )
      ).rows[0].id as string;
    leader = await insertCard("TEST-LEADER", "leader");
    card = await insertCard("TEST-MAIN", "character");
    alternate = await insertCard("TEST-MAIN", "character", card);
    await asUser(owner);
    deck = (
      await db.query(
        "insert into public.decks(name,leader_card_id) values('Owner deck',$1) returning id",
        [leader],
      )
    ).rows[0].id;
    version = (
      await db.query(
        "select public.save_deck_version($1,$2,$3,'first') as id",
        [deck, leader, JSON.stringify([{ card_id: card, quantity: 4 }])],
      )
    ).rows[0].id;
    tournament = (
      await db.query(
        "insert into public.tournaments(name,event_date,deck_version_id) values('Test event',current_date,$1) returning id",
        [version],
      )
    ).rows[0].id;
    match = (
      await db.query(
        "insert into public.matches(deck_version_id,opponent_leader_id,result,went_first,tournament_id) values($1,$2,'win',true,$3) returning id",
        [version, leader, tournament],
      )
    ).rows[0].id;
    await db.query(
      "insert into public.tournament_rounds(tournament_id,round_number,match_id,result) values($1,1,$2,'draw')",
      [tournament, match],
    );
    inventory = (
      await db.query(
        "insert into public.collection_items(card_id,quantity_owned,quantity_tradeable) values($1,4,1) returning id",
        [card],
      )
    ).rows[0].id;
    await db.query(
      "insert into public.collection_allocations(collection_item_id,deck_id,quantity) values($1,$2,2)",
      [inventory, deck],
    );
    await db.query(
      "insert into public.import_jobs(source,raw_input) values('manual','4 TEST-MAIN')",
    );
    await asUser(other);
    otherDeck = (
      await db.query(
        "insert into public.decks(name,leader_card_id) values('Other deck',$1) returning id",
        [leader],
      )
    ).rows[0].id;
    await asUser(owner);
  });
  afterAll(async () => {
    if (db) {
      await db.query("rollback");
      await db.end();
    }
  });

  it("enables RLS on every application table", async () => {
    await db.query("reset role");
    const rows = (
      await db.query(
        "select relname,relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r' and relname=any($1)",
        [
          [
            "cards",
            "card_restrictions",
            "decks",
            "deck_versions",
            "deck_cards",
            "matches",
            "tournaments",
            "tournament_rounds",
            "collection_items",
            "collection_allocations",
            "import_jobs",
          ],
        ],
      )
    ).rows;
    expect(rows).toHaveLength(11);
    expect(rows.every((row) => row.relrowsecurity)).toBe(true);
    await asUser(owner);
  });
  it("returns no private parent or nested rows from another account", async () => {
    await asUser(other);
    for (const table of [
      "deck_versions",
      "deck_cards",
      "matches",
      "tournaments",
      "tournament_rounds",
      "collection_items",
      "collection_allocations",
      "import_jobs",
    ]) {
      expect(
        (await db.query(`select * from public.${table}`)).rows,
      ).toHaveLength(0);
    }
    expect(
      (await db.query("select id from public.decks")).rows.map((row) => row.id),
    ).toEqual([otherDeck]);
    expect(
      (
        await db.query("update public.decks set name='stolen' where id=$1", [
          deck,
        ])
      ).rowCount,
    ).toBe(0);
    expect(
      (await db.query("delete from public.matches where id=$1", [match]))
        .rowCount,
    ).toBe(0);
    await asUser(owner);
  });
  it("blocks forged owner IDs and cross-owner nested links", async () => {
    await asUser(other);
    await rejects(
      "insert into public.decks(user_id,name,leader_card_id) values($1,'forged',$2)",
      [owner, leader],
    );
    await rejects(
      "insert into public.matches(deck_version_id,opponent_leader_id,result,went_first) values($1,$2,'loss',false)",
      [version, leader],
    );
    await rejects(
      "insert into public.tournaments(name,event_date,deck_version_id) values('forged',current_date,$1)",
      [version],
    );
    await rejects(
      "insert into public.collection_allocations(collection_item_id,deck_id,quantity) values($1,$2,1)",
      [inventory, otherDeck],
    );
    await rejects(
      "insert into public.tournament_rounds(tournament_id,round_number,match_id,result) values($1,2,$2,'win')",
      [tournament, match],
    );
    await rejects("select public.save_deck_version($1,$2,'[]')", [
      deck,
      leader,
    ]);
    await asUser(owner);
  });
  it("blocks anonymous reads and user catalog mutations", async () => {
    await db.query("reset role");
    await db.query("set local role anon");
    await rejects("select * from public.decks");
    await rejects("select public.save_deck_version($1,$2,'[]')", [
      deck,
      leader,
    ]);
    await asUser(owner);
    await rejects("update public.cards set name='tampered' where id=$1", [
      card,
    ]);
    await rejects(
      "insert into public.card_restrictions(canonical_card_id,format,restriction_type,maximum_quantity,effective_from,source_url) values($1,'standard','banned',0,current_date,'https://example.invalid')",
      [card],
    );
  });
  it("preserves old snapshots and exact match-version references", async () => {
    const second = (
      await db.query(
        "select public.save_deck_version($1,$2,$3,'second') as id",
        [
          deck,
          leader,
          JSON.stringify([
            { card_id: card, quantity: 3 },
            { card_id: alternate, quantity: 1 },
          ]),
        ],
      )
    ).rows[0].id;
    expect(second).not.toBe(version);
    expect(
      (
        await db.query(
          "select quantity from public.deck_cards where deck_version_id=$1",
          [version],
        )
      ).rows,
    ).toEqual([{ quantity: 4 }]);
    expect(
      (
        await db.query(
          "select deck_version_id from public.matches where id=$1",
          [match],
        )
      ).rows[0].deck_version_id,
    ).toBe(version);
    expect(
      (
        await db.query(
          "select version_number from public.deck_versions where deck_id=$1 order by version_number",
          [deck],
        )
      ).rows,
    ).toEqual([{ version_number: 1 }, { version_number: 2 }]);
    await rejects(
      "update public.deck_versions set notes='changed' where id=$1",
      [version],
    );
    await db.query("reset role");
    await rejects(
      "update public.deck_versions set notes='changed by privileged writer' where id=$1",
      [version],
    );
    await rejects(
      "update public.deck_cards set quantity=5 where deck_version_id=$1",
      [version],
    );
    await asUser(owner);
    await rejects("delete from public.deck_cards where deck_version_id=$1", [
      version,
    ]);
    await rejects(
      "insert into public.deck_cards(deck_version_id,card_id,quantity) values($1,$2,2)",
      [version, alternate],
    );
    await rejects("delete from public.decks where id=$1", [deck]);
  });
  it("enforces current-version membership and leader types", async () => {
    await rejects(
      "insert into public.decks(name,leader_card_id) values('invalid',$1)",
      [card],
    );
    await asUser(other);
    // The deferred composite FK is checked explicitly within the rejected operation.
    await db.query("savepoint membership");
    await db.query(
      "update public.decks set current_version_id=$1 where id=$2",
      [version, otherDeck],
    );
    let rejected = false;
    try {
      await db.query("set constraints decks_current_version_fk immediate");
    } catch {
      rejected = true;
    }
    await db.query("rollback to savepoint membership");
    expect(rejected).toBe(true);
    await asUser(owner);
  });
  it("rolls back an entire failed snapshot and rejects fractional, unknown or wrong-type entries", async () => {
    const before = (
      await db.query(
        "select current_version_id from public.decks where id=$1",
        [deck],
      )
    ).rows[0].current_version_id;
    for (const entries of [
      [
        { card_id: card, quantity: 1 },
        { card_id: card, quantity: 2 },
      ],
      [{ card_id: card, quantity: 1.5 }],
      [{ card_id: randomUUID(), quantity: 1 }],
      [{ card_id: leader, quantity: 1 }],
      [{ card_id: card, quantity: 0 }],
    ])
      await rejects("select public.save_deck_version($1,$2,$3)", [
        deck,
        leader,
        JSON.stringify(entries),
      ]);
    expect(
      (
        await db.query(
          "select current_version_id from public.decks where id=$1",
          [deck],
        )
      ).rows[0].current_version_id,
    ).toBe(before);
    expect(
      (
        await db.query("select id from public.deck_versions where deck_id=$1", [
          deck,
        ])
      ).rows,
    ).toHaveLength(2);
  });
  it("retains canonical identity across alternate printings", async () => {
    const rows = (
      await db.query(
        "select canonical_card_id from public.cards where id=any($1)",
        [[card, alternate]],
      )
    ).rows;
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.canonical_card_id === card)).toBe(true);
  });
  it("prevents double allocation and reduction of reserved inventory", async () => {
    await rejects(
      "update public.collection_allocations set quantity=4 where collection_item_id=$1",
      [inventory],
    );
    await rejects(
      "update public.collection_items set quantity_owned=2 where id=$1",
      [inventory],
    );
    await rejects(
      "update public.collection_items set quantity_tradeable=3 where id=$1",
      [inventory],
    );
    await db.query(
      "update public.collection_allocations set quantity=3 where collection_item_id=$1",
      [inventory],
    );
    expect(
      (
        await db.query(
          "select quantity from public.collection_allocations where collection_item_id=$1",
          [inventory],
        )
      ).rows[0].quantity,
    ).toBe(3);
  });
  it("archives events without losing matches and keeps round results consistent", async () => {
    expect(
      (
        await db.query(
          "select result from public.tournament_rounds where match_id=$1",
          [match],
        )
      ).rows[0].result,
    ).toBe("win");
    await db.query("update public.matches set result='draw' where id=$1", [
      match,
    ]);
    expect(
      (
        await db.query(
          "select result from public.tournament_rounds where match_id=$1",
          [match],
        )
      ).rows[0].result,
    ).toBe("draw");
    await db.query(
      "update public.tournaments set archived_at=now() where id=$1",
      [tournament],
    );
    expect(
      (await db.query("select id from public.matches where id=$1", [match]))
        .rowCount,
    ).toBe(1);
  });
});

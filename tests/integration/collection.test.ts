import { beforeAll, afterAll, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { connectLocalDatabase } from "../helpers/local-database";
let db: Client;
const owner = randomUUID(),
  other = randomUUID(),
  leader = randomUUID(),
  card = randomUUID(),
  foreignCard = randomUUID(),
  deck = randomUUID(),
  secondDeck = randomUUID(),
  item = randomUUID();
let version: string, secondVersion: string;
async function query(sql: string, args: unknown[] = []) {
  return db.query(
    sql,
    args.map((v) => (Array.isArray(v) ? JSON.stringify(v) : v)),
  );
}
async function asUser(user: string) {
  await query("reset role");
  await query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
  await query("set local role authenticated");
}
async function rejected(sql: string, args: unknown[] = []) {
  await query("savepoint rejected");
  let failed = false;
  try {
    await query(sql, args);
  } catch {
    failed = true;
  }
  await query("rollback to savepoint rejected");
  expect(failed).toBe(true);
}
beforeAll(async () => {
  db = await connectLocalDatabase();
  await query("begin");
  await query("insert into auth.users(id,email) values($1,$2),($3,$4)", [
    owner,
    `${owner}@example.invalid`,
    other,
    `${other}@example.invalid`,
  ]);
  await asUser(other);
  await query(
    "insert into cards(id,user_id,card_number,name,card_type,source,colors) values($1,$2,'OP98-099','Private foreign card','character','manual','{red}')",
    [foreignCard, other],
  );
  await asUser(owner);
  for (const [id, number, type] of [
    [leader, "OP98-001", "leader"],
    [card, "OP98-010", "character"],
  ])
    await query(
      "insert into cards(id,user_id,card_number,name,card_type,source,colors) values($1,$2,$3,'Synthetic collection card',$4,'manual','{red}')",
      [id, owner, number, type],
    );
  for (const id of [deck, secondDeck])
    await query("select save_deck($1)", [
      {
        id,
        expected_version_id: "",
        name: "Synthetic physical deck",
        leader_card_id: leader,
        format: "standard",
        status: "draft",
        cards: [{ card_id: card, quantity: 4, role: "main" }],
      },
    ]);
  version = (
    await query("select current_version_id from decks where id=$1", [deck])
  ).rows[0].current_version_id;
  secondVersion = (
    await query("select current_version_id from decks where id=$1", [
      secondDeck,
    ])
  ).rows[0].current_version_id;
  await query(
    "insert into collection_items(id,card_id,quantity_owned,quantity_tradeable) values($1,$2,5,1)",
    [item, card],
  );
});
afterAll(async () => {
  if (db) {
    await query("rollback");
    await db.end();
  }
});
it("persists exact-printing goals idempotently without reducing a goal or changing notes", async () => {
  await query(
    "insert into wishlist_items(card_id,target_quantity,priority,notes) values($1,6,'high','Keep exact art')",
    [card],
  );
  await query("select raise_wishlist_target($1,4)", [card]);
  await query("select raise_wishlist_target($1,4)", [card]);
  expect(
    (
      await query(
        "select target_quantity,priority,notes from wishlist_items where card_id=$1",
        [card],
      )
    ).rows,
  ).toEqual([
    { target_quantity: 6, priority: "high", notes: "Keep exact art" },
  ]);
  expect(
    (
      await query("select quantity_owned from collection_items where id=$1", [
        item,
      ])
    ).rows[0].quantity_owned,
  ).toBe(5);
});
it("atomically reserves copies, excludes tradeable inventory, and restores prior reservations on failure", async () => {
  await query("select set_deck_allocations($1,$2,$3)", [
    deck,
    version,
    [{ collection_item_id: item, quantity: 3 }],
  ]);
  await rejected("select set_deck_allocations($1,$2,$3)", [
    secondDeck,
    secondVersion,
    [{ collection_item_id: item, quantity: 2 }],
  ]);
  await rejected("select set_deck_allocations($1,$2,$3)", [
    deck,
    version,
    [{ collection_item_id: item, quantity: 5 }],
  ]);
  expect(
    (
      await query(
        "select deck_id,quantity from collection_allocations where collection_item_id=$1",
        [item],
      )
    ).rows,
  ).toEqual([{ deck_id: deck, quantity: 3 }]);
  await rejected("select set_deck_allocations($1,$2,$3)", [
    deck,
    version,
    [
      { collection_item_id: item, quantity: 1 },
      { collection_item_id: item, quantity: 1 },
    ],
  ]);
  await rejected("select set_deck_allocations($1,$2,null)", [deck, version]);
});
it("rejects stale versions, deleting reserved lots and reducing owned or exchangeable availability", async () => {
  await rejected("select set_deck_allocations($1,$2,$3)", [
    deck,
    secondVersion,
    [],
  ]);
  await rejected("delete from collection_items where id=$1", [item]);
  await rejected(
    "update collection_items set quantity_owned=2,quantity_tradeable=0 where id=$1",
    [item],
  );
  await rejected(
    "update collection_items set quantity_tradeable=4 where id=$1",
    [item],
  );
});
it("enforces private wish/item/allocation ownership and rejects foreign-card attachment through direct writes and RPC", async () => {
  await rejected(
    "insert into wishlist_items(card_id,target_quantity) values($1,1)",
    [foreignCard],
  );
  await rejected("select raise_wishlist_target($1,1)", [foreignCard]);
  await rejected(
    "insert into wishlist_items(user_id,card_id,target_quantity) values($1,$2,1)",
    [other, card],
  );
  await asUser(other);
  for (const table of [
    "wishlist_items",
    "collection_items",
    "collection_allocations",
  ])
    expect(
      (await query(`select id from ${table} where user_id=$1`, [owner])).rows,
    ).toEqual([]);
  await rejected("select set_deck_allocations($1,$2,$3)", [deck, version, []]);
  await rejected(
    "insert into collection_allocations(collection_item_id,deck_id,quantity) values($1,$2,1)",
    [item, secondDeck],
  );
  await asUser(owner);
  await rejected("update wishlist_items set card_id=$1 where card_id=$2", [
    leader,
    card,
  ]);
});
it("supports explicit release and optimistic inventory updates without dropping owned copies", async () => {
  const before = (
    await query(
      "select updated_at::text as stamp from collection_items where id=$1",
      [item],
    )
  ).rows[0].stamp;
  await query("select set_deck_allocations($1,$2,$3)", [deck, version, []]);
  await query(
    "update collection_items set quantity_owned=6 where id=$1 and updated_at=$2 returning id",
    [item, before],
  );
  await query("update collection_items set quantity_owned=7 where id=$1", [
    item,
  ]);
  expect(
    (
      await query(
        "update collection_items set quantity_owned=100 where id=$1 and updated_at=$2 returning id",
        [item, before],
      )
    ).rows,
  ).toEqual([]);
  expect(
    (
      await query("select quantity_owned from collection_items where id=$1", [
        item,
      ])
    ).rows[0].quantity_owned,
  ).toBe(7);
  expect(
    (
      await query("select id from collection_allocations where deck_id=$1", [
        deck,
      ])
    ).rows,
  ).toEqual([]);
});
it("denies anonymous access and invalid wish quantities", async () => {
  await rejected(
    "insert into wishlist_items(card_id,target_quantity) values($1,0)",
    [leader],
  );
  await query("reset role");
  await query("set local role anon");
  await rejected("select * from wishlist_items");
  await rejected("select raise_wishlist_target($1,1)", [card]);
  await asUser(owner);
});

it("serializes competing physical decks across real transactions and cascades account cleanup", async () => {
  const admin = await connectLocalDatabase(),
    a = await connectLocalDatabase(),
    b = await connectLocalDatabase();
  const user = randomUUID(),
    c = randomUUID(),
    l = randomUUID(),
    first = randomUUID(),
    second = randomUUID(),
    lot = randomUUID();
  try {
    await admin.query("insert into auth.users(id,email) values($1,$2)", [
      user,
      `${user}@example.invalid`,
    ]);
    await a.query("begin");
    await a.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
    await a.query("set local role authenticated");
    for (const [id, type, number] of [
      [l, "leader", "OP99-001"],
      [c, "character", "OP99-010"],
    ])
      await a.query(
        "insert into cards(id,user_id,card_number,name,card_type,source,colors) values($1,$2,$3,'Synthetic concurrency',$4,'manual','{red}')",
        [id, user, number, type],
      );
    for (const id of [first, second])
      await a.query("select save_deck($1)", [
        {
          id,
          expected_version_id: "",
          name: "Synthetic competing deck",
          leader_card_id: l,
          format: "standard",
          status: "draft",
          cards: [],
        },
      ]);
    await a.query(
      "insert into collection_items(id,card_id,quantity_owned) values($1,$2,4)",
      [lot, c],
    );
    await a.query(
      "insert into wishlist_items(card_id,target_quantity) values($1,4)",
      [c],
    );
    await a.query("commit");
    const versions = (
      await admin.query(
        "select id,current_version_id from decks where user_id=$1",
        [user],
      )
    ).rows;
    for (const connection of [a, b]) {
      await connection.query("begin");
      await connection.query(
        "select set_config('request.jwt.claim.sub',$1,true)",
        [user],
      );
      await connection.query("set local role authenticated");
      await connection.query("set local statement_timeout='4000ms'");
    }
    const data = JSON.stringify([{ collection_item_id: lot, quantity: 4 }]);
    await a.query("select set_deck_allocations($1,$2,$3)", [
      first,
      versions.find((v) => v.id === first).current_version_id,
      data,
    ]);
    const competing = b.query("select set_deck_allocations($1,$2,$3)", [
      second,
      versions.find((v) => v.id === second).current_version_id,
      data,
    ]);
    const outcome = Promise.allSettled([competing]);
    await a.query("commit");
    const result = (await outcome)[0];
    expect(result.status).toBe("rejected");
    if (result.status === "rejected")
      expect(result.reason.message).toContain("Insufficient unallocated");
    await b.query("rollback");
    expect(
      (
        await admin.query(
          "select sum(quantity)::int as n from collection_allocations where collection_item_id=$1",
          [lot],
        )
      ).rows[0].n,
    ).toBe(4);
    await admin.query("delete from auth.users where id=$1", [user]);
    for (const table of [
      "wishlist_items",
      "collection_items",
      "collection_allocations",
      "cards",
    ])
      expect(
        (await admin.query(`select id from ${table} where user_id=$1`, [user]))
          .rows,
      ).toEqual([]);
  } finally {
    await a.query("rollback");
    await b.query("rollback");
    await admin.query("delete from collection_allocations where user_id=$1", [
      user,
    ]);
    await admin.query("delete from auth.users where id=$1", [user]);
    await a.end();
    await b.end();
    await admin.end();
  }
});

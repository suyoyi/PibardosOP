import { beforeAll, afterAll, it, expect, describe } from "vitest";
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { connectLocalDatabase } from "../helpers/local-database";
describe("manual catalog and atomic deck workflows", () => {
  let db: Client;
  const owner = randomUUID(),
    other = randomUUID(),
    leader = randomUUID(),
    card = randomUUID(),
    deck = randomUUID();
  let current: string;
  const payload = () => ({
    id: deck,
    name: "Imported test deck",
    expected_version_id: current ?? "",
    leader_card_id: leader,
    description: "",
    format: "standard",
    status: "draft",
    tags: [],
    notes: "Synthetic import",
    cards: [{ card_id: card, quantity: 4, role: "main" }],
  });
  async function asUser(id: string) {
    await db.query("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
    await db.query("set local role authenticated");
  }
  async function rejected(sql: string, args: unknown[] = []) {
    await db.query("savepoint rejected");
    let failed = false;
    try {
      await db.query(sql, args);
    } catch {
      failed = true;
    }
    await db.query("rollback to savepoint rejected");
    expect(failed).toBe(true);
  }
  beforeAll(async () => {
    db = await connectLocalDatabase();
    await db.query("begin");
    await db.query("insert into auth.users(id,email) values($1,$2),($3,$4)", [
      owner,
      `${owner}@example.invalid`,
      other,
      `${other}@example.invalid`,
    ]);
    await asUser(owner);
    for (const [id, code, type] of [
      [leader, "OP99-001", "leader"],
      [card, "OP99-002", "character"],
    ])
      await db.query(
        "insert into public.cards(id,user_id,card_number,name,card_type,source,colors) values($1,$2,$3,'Synthetic fixture',$4,'manual','{red}')",
        [id, owner, code, type],
      );
  });
  afterAll(async () => {
    if (db) {
      await db.query("rollback");
      await db.end();
    }
  });
  it("isolates manual cards and blocks forged private-card references", async () => {
    await asUser(other);
    expect(
      (
        await db.query("select id from cards where id=any($1)", [
          [leader, card],
        ])
      ).rows,
    ).toEqual([]);
    await rejected(
      "insert into cards(user_id,card_number,name,card_type,source) values($1,'OP99-001','forged','leader','manual')",
      [owner],
    );
    await rejected(
      "insert into decks(name,leader_card_id) values('stolen private leader',$1)",
      [leader],
    );
    await rejected(
      "insert into cards(user_id,card_number,name,card_type,source,canonical_card_id) values($1,'OP99-003','forged','character','manual',$2)",
      [other, card],
    );
    await asUser(owner);
  });
  it("atomically creates a deck, its initial snapshot and confirmed import", async () => {
    const job = randomUUID();
    await db.query(
      "insert into import_jobs(id,source,status,raw_input) values($1,'text','preview','4 OP99-002')",
      [job],
    );
    const p = { ...payload(), import_job_id: job, raw_input: "4 OP99-002" };
    expect((await db.query("select save_deck($1) id", [p])).rows[0].id).toBe(
      deck,
    );
    current = (
      await db.query("select current_version_id from decks where id=$1", [deck])
    ).rows[0].current_version_id;
    expect(
      (await db.query("select status from import_jobs where id=$1", [job]))
        .rows[0].status,
    ).toBe("confirmed");
    expect(
      (
        await db.query(
          "select quantity from deck_cards where deck_version_id=$1",
          [current],
        )
      ).rows,
    ).toEqual([{ quantity: 4 }]);
  });
  it("updates metadata without generating redundant snapshots", async () => {
    await db.query("select save_deck($1)", [
      { ...payload(), name: "Renamed deck" },
    ]);
    expect(
      (await db.query("select id from deck_versions where deck_id=$1", [deck]))
        .rows,
    ).toHaveLength(1);
    expect(
      (await db.query("select name from decks where id=$1", [deck])).rows[0]
        .name,
    ).toBe("Renamed deck");
  });
  it("creates a new immutable version, retains the old entries and rejects stale edits", async () => {
    const old = current;
    await db.query("select save_deck($1)", [
      {
        ...payload(),
        name: "Renamed deck",
        cards: [{ card_id: card, quantity: 3, role: "main" }],
        notes: "Reduced quantity",
      },
    ]);
    current = (
      await db.query("select current_version_id from decks where id=$1", [deck])
    ).rows[0].current_version_id;
    expect(current).not.toBe(old);
    expect(
      (
        await db.query(
          "select quantity from deck_cards where deck_version_id=$1",
          [old],
        )
      ).rows[0].quantity,
    ).toBe(4);
    await rejected("select save_deck($1)", [
      { ...payload(), expected_version_id: old },
    ]);
  });
  it("rolls back metadata and new-deck creation if any card or import confirmation fails", async () => {
    const newId = randomUUID();
    await rejected("select save_deck($1)", [
      {
        ...payload(),
        id: newId,
        expected_version_id: "",
        cards: [{ card_id: randomUUID(), quantity: 2 }],
      },
    ]);
    expect(
      (await db.query("select id from decks where id=$1", [newId])).rows,
    ).toEqual([]);
    await rejected("select save_deck($1)", [
      {
        ...payload(),
        name: "Must roll back",
        import_job_id: randomUUID(),
        raw_input: "bad",
      },
    ]);
    expect(
      (await db.query("select name from decks where id=$1", [deck])).rows[0]
        .name,
    ).toBe("Renamed deck");
  });
  it("duplicates into independent version history and removes an unreferenced duplicate", async () => {
    const copy = randomUUID();
    await db.query("select save_deck($1)", [
      { ...payload(), id: copy, expected_version_id: "" },
    ]);
    const v = (
      await db.query("select * from deck_versions where deck_id=$1", [copy])
    ).rows[0];
    expect(v.id).not.toBe(current);
    expect(v.version_number).toBe(1);
    await db.query("delete from decks where id=$1", [copy]);
    expect(
      (await db.query("select id from deck_versions where deck_id=$1", [copy]))
        .rows,
    ).toEqual([]);
  });
  it("rejects another account invoking the atomic deck RPC", async () => {
    await asUser(other);
    await rejected("select save_deck($1)", [payload()]);
    await asUser(owner);
  });
});

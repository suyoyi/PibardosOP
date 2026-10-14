import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { connectLocalDatabase } from "../helpers/local-database";
describe("atomic match, event and ownership workflows", () => {
  let db: Client;
  const owner = randomUUID(),
    other = randomUUID(),
    leader = randomUUID(),
    card = randomUUID(),
    deck = randomUUID(),
    event = randomUUID(),
    game = randomUUID();
  let version: string, nextVersion: string;
  const input = (overrides: Record<string, unknown> = {}) => ({
    id: game,
    deck_version_id: version,
    opponent_leader_id: leader,
    result: "win",
    went_first: true,
    played_at: "2026-03-01T12:00:00Z",
    format: "standard",
    match_type: "tournament",
    opponent_name: "Synthetic opponent",
    tournament_id: event,
    round_number: 1,
    notes: "Synthetic notes",
    ...overrides,
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
      [leader, "OP96-001", "leader"],
      [card, "OP96-002", "character"],
    ])
      await db.query(
        "insert into cards(id,user_id,card_number,name,card_type,source,colors) values($1,$2,$3,'Synthetic competitive fixture',$4,'manual','{red}')",
        [id, owner, code, type],
      );
    await db.query("select save_deck($1)", [
      {
        id: deck,
        expected_version_id: "",
        name: "Synthetic competitive deck",
        leader_card_id: leader,
        format: "standard",
        status: "draft",
        cards: [{ card_id: card, quantity: 4, role: "main" }],
      },
    ]);
    version = (
      await db.query("select current_version_id from decks where id=$1", [deck])
    ).rows[0].current_version_id;
    await db.query(
      "insert into tournaments(id,name,event_date,deck_version_id) values($1,'Synthetic event','2026-03-01',$2)",
      [event, version],
    );
  });
  afterAll(async () => {
    if (db) {
      await db.query("rollback");
      await db.end();
    }
  });
  it("commits a round and a version-specific match together, with retry protection", async () => {
    await db.query("select save_match($1)", [input()]);
    await db.query("select save_match($1)", [input()]);
    expect(
      (
        await db.query(
          "select result,went_first,deck_version_id,opponent_leader_id from matches where id=$1",
          [game],
        )
      ).rows,
    ).toEqual([
      {
        result: "win",
        went_first: true,
        deck_version_id: version,
        opponent_leader_id: leader,
      },
    ]);
    expect(
      (
        await db.query(
          "select round_number,result from tournament_rounds where tournament_id=$1",
          [event],
        )
      ).rows,
    ).toEqual([{ round_number: 1, result: "win" }]);
  });
  it("updates result and play order without duplicating the round", async () => {
    await db.query("select save_match($1)", [
      input({
        result: "loss",
        went_first: false,
        opponent_name: "Corrected rival",
      }),
    ]);
    expect(
      (
        await db.query(
          "select result,opponent_name from tournament_rounds where match_id=$1",
          [game],
        )
      ).rows,
    ).toEqual([{ result: "loss", opponent_name: "Corrected rival" }]);
    expect(
      (await db.query("select went_first from matches where id=$1", [game]))
        .rows[0].went_first,
    ).toBe(false);
  });
  it("rolls back duplicate rounds and conflicting event/version/format references", async () => {
    const id = randomUUID();
    await rejected("select save_match($1)", [input({ id })]);
    expect(
      (await db.query("select id from matches where id=$1", [id])).rows,
    ).toEqual([]);
    await rejected("select save_match($1)", [
      input({ id, round_number: 2, format: "other" }),
    ]);
    expect(
      (
        await db.query(
          "select round_number from tournament_rounds where match_id=$1",
          [game],
        )
      ).rows[0].round_number,
    ).toBe(1);
  });
  it("keeps historical version references after editing a deck and freezes event selection", async () => {
    await db.query("select save_deck($1)", [
      {
        id: deck,
        expected_version_id: version,
        name: "Synthetic competitive deck",
        leader_card_id: leader,
        format: "standard",
        status: "draft",
        cards: [{ card_id: card, quantity: 3, role: "main" }],
      },
    ]);
    nextVersion = (
      await db.query("select current_version_id from decks where id=$1", [deck])
    ).rows[0].current_version_id;
    expect(nextVersion).not.toBe(version);
    expect(
      (
        await db.query("select deck_version_id from matches where id=$1", [
          game,
        ])
      ).rows[0].deck_version_id,
    ).toBe(version);
    await rejected("update tournaments set deck_version_id=$1 where id=$2", [
      nextVersion,
      event,
    ]);
    await rejected("update tournaments set format='other' where id=$1", [
      event,
    ]);
    await rejected("select save_match($1)", [
      input({ deck_version_id: nextVersion }),
    ]);
  });
  it("blocks another account from reading, modifying or overwriting match/event IDs", async () => {
    await asUser(other);
    expect(
      (await db.query("select id from matches where id=$1", [game])).rows,
    ).toEqual([]);
    expect(
      (
        await db.query(
          "select id from tournament_rounds where tournament_id=$1",
          [event],
        )
      ).rows,
    ).toEqual([]);
    await rejected("select save_match($1)", [input()]);
    await rejected(
      "insert into tournaments(name,event_date,deck_version_id) values('forged',current_date,$1)",
      [version],
    );
    await asUser(owner);
  });
  it("archives without losing history, allows corrections and blocks new archived rounds", async () => {
    await db.query(
      "update tournaments set archived_at=now(),placement=2 where id=$1",
      [event],
    );
    await rejected("select save_match($1)", [
      input({ id: randomUUID(), round_number: 2 }),
    ]);
    await db.query("select save_match($1)", [input({ result: "draw" })]);
    expect(
      (await db.query("select result from matches where id=$1", [game])).rows[0]
        .result,
    ).toBe("draw");
    expect(
      (
        await db.query(
          "select result from tournament_rounds where match_id=$1",
          [game],
        )
      ).rows[0].result,
    ).toBe("draw");
  });
  it("removes the linked round on match deletion and preserves other games", async () => {
    const free = randomUUID();
    await db.query("select save_match($1)", [
      input({
        id: free,
        tournament_id: "",
        round_number: "",
        deck_version_id: nextVersion,
        match_type: "friendly",
      }),
    ]);
    await db.query("delete from matches where id=$1", [game]);
    expect(
      (
        await db.query("select id from tournament_rounds where match_id=$1", [
          game,
        ])
      ).rows,
    ).toEqual([]);
    expect(
      (await db.query("select id from matches where id=$1", [free])).rows,
    ).toHaveLength(1);
  });
});

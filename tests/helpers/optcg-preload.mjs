// Loaded only by Playwright's server command, never by development/deployment.
// Intercept all provider traffic so normal browser tests use no live card site.
import { optcgRecord, optcgHistoryRecord } from "../fixtures/optcg.ts";
const original = globalThis.fetch;
const leader = optcgRecord({
  card_set_id: "OP97-001",
  card_image_id: "OP97-001",
  card_name: "Synthetic OPTCG leader",
  card_type: "Leader",
  life: "5",
  card_cost: null,
  counter_amount: null,
  card_image: "https://optcgapi.com/media/static/Card_Images/OP97-001.jpg",
});
const base = optcgRecord(),
  alternate = optcgRecord({
    card_image_id: "OP97-010_p1",
    card_name: "Synthetic OPTCG character parallel",
    market_price: 0,
    counter_amount: 0,
    card_image: "https://optcgapi.com/media/static/Card_Images/OP97-010_p1.jpg",
  });
const incompatible = optcgRecord({
  card_set_id: "OP97-011",
  card_image_id: "OP97-011",
  card_name: "Synthetic incompatible blue card",
  card_color: "Blue",
});
const records = [leader, base, alternate, incompatible];
const leaderAlternate = {
  ...leader,
  card_image_id: "OP97-001_p1",
  card_name: "Synthetic OPTCG leader parallel",
  card_image: "https://optcgapi.com/media/static/Card_Images/OP97-001_p1.jpg",
};
const reprint = optcgRecord({
  card_image_id: "OP97-010_r1",
  card_name: "Synthetic OPTCG reprint",
  set_id: "ST-97",
  card_image: "https://optcgapi.com/media/static/Card_Images/OP97-010_r1.jpg",
});
const png = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  ),
);
globalThis.fetch = async (input, init) => {
  const value =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const url = new URL(value);
  if (!["optcgapi.com", "www.optcgapi.com"].includes(url.hostname))
    return original(input, init);
  if (url.pathname === "/api/sets/card/twoweeks/OP97-010/")
    return Response.json([
      optcgHistoryRecord(base),
      optcgHistoryRecord({
        ...alternate,
        Day1_Market_Price: 0,
        Day2_Market_Price: null,
        Day2_Inventory_Price: null,
      }),
    ]);
  if (url.pathname === "/api/sets/card/twoweeks/OP97-011/")
    return new Response(null, { status: 500 });
  if (url.pathname === "/api/allSetCards/")
    return Response.json([...records, leaderAlternate]);
  if (url.pathname === "/api/allSTCards/") return Response.json([]);
  if (url.pathname === "/api/allPromos/")
    return Response.json([{ ...reprint, market_price: null }]);
  if (url.pathname === "/api/allDonCards/") return Response.json([]);
  if (url.pathname === "/api/allSets/")
    return Response.json([
      { set_id: "OP-97", set_name: "Synthetic expansion" },
      { set_id: "OP-01", set_name: "Synthetic first expansion" },
    ]);
  if (url.pathname === "/api/allDecks/")
    return Response.json([
      { structure_deck_id: "ST-97", structure_deck_name: "Synthetic starter" },
    ]);
  if (["/api/decks/filtered/", "/api/promos/filtered/"].includes(url.pathname))
    return Response.json([]);
  if (url.pathname.startsWith("/media/static/Card_Images/"))
    return new Response(png, { headers: { "Content-Type": "image/png" } });
  if (["/api/sets/OP-97/", "/api/sets/OP-01/"].includes(url.pathname))
    return Response.json(records);
  if (url.pathname === "/api/promos/card/OP97-010/")
    return Response.json([reprint]);
  const match = url.pathname.match(/^\/api\/sets\/card\/(OP97-\d{3})\/$/);
  if (match) {
    const found = [...records, leaderAlternate].filter(
      (c) => c.card_set_id === match[1],
    );
    return found.length
      ? Response.json(found)
      : new Response(null, { status: 404 });
  }
  if (
    url.pathname === "/api/sets/filtered/" &&
    url.searchParams.get("card_name") === "Synthetic OPTCG character"
  )
    return new Response(null, { status: 503 });
  if (
    url.pathname === "/api/sets/filtered/" &&
    url.searchParams.get("card_name") === "Unavailable"
  )
    return Response.json([
      optcgRecord({
        card_set_id: "OP97-066",
        card_image_id: "OP97-066",
        card_name: "Synthetic unavailable card",
      }),
    ]);
  if (
    url.pathname === "/api/sets/filtered/" &&
    url.searchParams.get("card_name") === "delayed"
  ) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return Response.json([base]);
  }
  if (
    url.pathname === "/api/sets/filtered/" &&
    url.searchParams.get("card_type") === "Leader"
  )
    return Response.json([leader]);
  if (url.pathname === "/api/sets/filtered/")
    return Response.json(
      records.filter((c) =>
        String(c.card_name)
          .toLowerCase()
          .includes((url.searchParams.get("card_name") ?? "").toLowerCase()),
      ),
    );
  return new Response(null, { status: 404 });
};

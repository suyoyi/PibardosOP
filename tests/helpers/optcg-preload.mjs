// Loaded only by Playwright's server command, never by development/deployment.
// Intercept all provider traffic so normal browser tests use no live card site.
import { optcgRecord } from "../fixtures/optcg.ts";
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
    card_image: "https://optcgapi.com/media/static/Card_Images/OP97-010_p1.jpg",
  });
const records = [leader, base, alternate];
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
  if (url.pathname.startsWith("/media/static/Card_Images/"))
    return new Response(png, { headers: { "Content-Type": "image/png" } });
  if (["/api/sets/OP-97/", "/api/sets/OP-01/"].includes(url.pathname))
    return Response.json(records);
  const match = url.pathname.match(/^\/api\/sets\/card\/(OP97-\d{3})\/$/);
  if (match) {
    const found = records.filter((c) => c.card_set_id === match[1]);
    return found.length
      ? Response.json(found)
      : new Response(null, { status: 404 });
  }
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

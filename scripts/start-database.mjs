import { spawnSync, execFileSync } from "node:child_process";
import { Client } from "pg";

// Some cloud proxies break BusyBox's loopback wget probe. A documented opt-in
// replaces that probe with actual database/Auth/REST checks; no readiness is assumed.
const httpReadiness = process.env.PIBARDOS_HTTP_READINESS === "true";
const result = spawnSync(
  process.execPath,
  [
    "scripts/supabase.mjs",
    "start",
    ...(httpReadiness ? ["--ignore-health-check"] : []),
  ],
  { stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status ?? 1);
const status = JSON.parse(
  execFileSync(
    process.execPath,
    ["scripts/supabase.mjs", "status", "--output", "json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ),
);
const api = status.API_URL ?? status.api_url;
const key =
  status.PUBLISHABLE_KEY ??
  status.ANON_KEY ??
  status.publishable_key ??
  status.anon_key;
const connection = status.DB_URL ?? status.db_url;
if (
  !api ||
  !key ||
  !connection ||
  !["localhost", "127.0.0.1"].includes(new URL(api).hostname)
)
  throw new Error("Local connection settings are missing.");
let ready = false;
for (let attempt = 0; attempt < 15; attempt++) {
  const db = new Client({
    connectionString: connection,
    connectionTimeoutMillis: 3000,
  });
  try {
    await db.connect();
    await db.query("select 1");
    const auth = await fetch(`${api}/auth/v1/health`, {
      signal: AbortSignal.timeout(3000),
    });
    const rest = await fetch(`${api}/rest/v1/`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(3000),
    });
    const body = await auth.json();
    const spec = await rest.json();
    ready =
      auth.ok &&
      body.name === "GoTrue" &&
      rest.ok &&
      Boolean(spec.swagger || spec.openapi);
  } catch {
    ready = false;
  } finally {
    await db.end().catch(() => {});
  }
  if (ready) break;
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
if (!ready)
  throw new Error(
    "Local PostgreSQL, Auth and REST API readiness checks failed.",
  );
// Apply pending version-controlled local migrations even when containers already
// exist. This is additive migration replay, never a data reset.
const migration = spawnSync(
  process.execPath,
  ["scripts/supabase.mjs", "migration", "up", "--local"],
  { stdio: "inherit" },
);
if (migration.status !== 0) process.exit(migration.status ?? 1);
console.log(
  "Verified PostgreSQL query, Auth health and PostgREST OpenAPI response.",
);

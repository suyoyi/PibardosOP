import { execFileSync } from "node:child_process";
import { Client } from "pg";

export async function connectLocalDatabase(testDatabase?: string) {
  const status = JSON.parse(
    execFileSync(
      process.execPath,
      ["scripts/supabase.mjs", "status", "--output", "json"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ),
  );
  const connectionString = status.DB_URL ?? status.db_url;
  if (
    !connectionString ||
    !["localhost", "127.0.0.1"].includes(new URL(connectionString).hostname)
  )
    throw new Error(
      "Tests require a running local Supabase database. Run npm run db:start.",
    );
  const destination = new URL(connectionString);
  if (testDatabase) {
    if (!/^pibardos_migrations_[a-z0-9]+$/.test(testDatabase))
      throw new Error("Only disposable migration-test databases are allowed.");
    destination.pathname = `/${testDatabase}`;
  }
  const client = new Client({ connectionString: destination.toString() });
  await client.connect();
  return client;
}

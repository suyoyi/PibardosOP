import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

// Capture status without printing local keys. Never overwrite an existing user configuration.
const status = JSON.parse(
  execFileSync(
    process.execPath,
    ["scripts/supabase.mjs", "status", "--output", "json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ),
);
const url = status.API_URL ?? status.api_url;
const key =
  status.PUBLISHABLE_KEY ??
  status.ANON_KEY ??
  status.publishable_key ??
  status.anon_key;
if (!url || !key)
  throw new Error("Supabase status did not return a public URL and key.");
writeFileSync(
  ".env.local",
  `NEXT_PUBLIC_SUPABASE_URL=${url}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${key}\n`,
  { flag: "wx", mode: 0o600 },
);
console.log(
  "Created ignored .env.local with local public connection settings. No service-role key was copied.",
);

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { format } from "prettier";
const types = execFileSync(
  process.execPath,
  ["scripts/supabase.mjs", "gen", "types", "typescript", "--local"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
);
if (!types.includes("export type Database"))
  throw new Error("Type generation did not return a Database contract.");
writeFileSync(
  "src/lib/supabase/database.types.ts",
  await format(types, { parser: "typescript" }),
);

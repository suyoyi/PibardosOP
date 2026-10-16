import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const child = spawn(
  process.execPath,
  [
    path.join(root, "node_modules/supabase/dist/supabase.js"),
    ...process.argv.slice(2),
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      SUPABASE_HOME:
        process.env.SUPABASE_HOME ?? path.resolve(root, "../.supabase-cli"),
      SUPABASE_TELEMETRY_DISABLED: "true",
      // The CLI's official, digest-pinned reduced images fit the cloud Docker storage limit.
      SUPABASE_USE_SLIM_IMAGES: process.env.SUPABASE_USE_SLIM_IMAGES ?? "true",
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});

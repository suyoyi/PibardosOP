import { spawn, spawnSync } from "node:child_process";
import { existsSync, openSync, closeSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDependencies } from "./dependencies.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const port = Number(process.env.PIBARDOS_APP_PORT ?? "3000");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PIBARDOS_APP_PORT must be a valid port number.");
}
const base = `http://127.0.0.1:${port}`;

function run(args, privateOutput = false) {
  const result = spawnSync("npm", args, {
    cwd: root,
    stdio: ["ignore", privateOutput ? "ignore" : "inherit", "inherit"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `npm ${args.join(" ")} failed. Fix the reported prerequisite before retrying.`,
    );
  }
}

// Docker-in-Docker initializes before the Codespaces post-start hook.
let dockerReady = false;
for (let attempt = 0; attempt < 30; attempt++) {
  dockerReady = spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0;
  if (dockerReady) break;
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (!dockerReady)
  throw new Error(
    "Docker is unavailable. Rebuild the Codespace with the repository's devcontainer configuration.",
  );

ensureDependencies(root, () => {
  run(["ci", "--cache", "/tmp/pibardos-npm-cache"]);
});
console.log("Starting local database and authentication…");
// CLI status can contain local keys; keep its stdout out of terminal logs.
run(["run", "db:start"], true);

const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const hasKey = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
if (hasUrl !== hasKey) {
  throw new Error(
    "Provide both Supabase public connection variables, or remove the partial configuration to use local Supabase.",
  );
}
if (!existsSync(".env.local") && !hasUrl) run(["run", "setup:local"]);

async function appReady() {
  try {
    const health = await fetch(`${base}/api/health`, {
      signal: AbortSignal.timeout(2000),
    });
    const body = await health.json();
    if (
      !health.ok ||
      body.application !== "pibardos-op" ||
      body.status !== "ok"
    )
      return false;
    const login = await fetch(`${base}/login`, {
      signal: AbortSignal.timeout(2000),
    });
    const html = await login.text();
    return (
      login.ok &&
      html.includes('name="email"') &&
      html.includes('name="password"')
    );
  } catch {
    return false;
  }
}

if (await appReady()) {
  console.log(
    `Pibardos OP is already ready. Open port ${port} in the Ports tab.`,
  );
  process.exit(0);
}

// A local production build also enables the PWA worker. This is not deployment.
run(["run", "build"]);
const logPath = `/tmp/pibardos-preview-${port}.log`;
const log = openSync(logPath, "a", 0o600);
const child = spawn("npm", ["run", "start", "--", "--port", String(port)], {
  cwd: root,
  detached: true,
  stdio: ["ignore", log, log],
});
closeSync(log);
let startupError;
child.on("error", (error) => {
  startupError = error;
});
const deadline = Date.now() + 60000;
while (Date.now() < deadline && !startupError && child.exitCode === null) {
  if (await appReady()) {
    child.unref();
    console.log(
      `Pibardos OP is ready. Open port ${port} in the Ports tab and create your account.`,
    );
    process.exit(0);
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
// Stop only the process group this invocation created; never an unknown port owner.
if (child.pid) {
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    /* process already exited */
  }
}
throw (
  startupError ??
  new Error(
    `The app did not become ready. Inspect ${logPath} and check that port ${port} is free.`,
  )
);

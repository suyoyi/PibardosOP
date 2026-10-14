import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Start this launcher with npm run local:start.");
const port = Number(process.env.PIBARDOS_APP_PORT ?? "3000");
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid PIBARDOS_APP_PORT.");
const url = `http://127.0.0.1:${port}`;

function run(args, privateOutput = false) {
  const result = spawnSync(process.execPath, [npmCli, ...args], {
    cwd: root,
    stdio: ["inherit", privateOutput ? "ignore" : "inherit", "inherit"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`npm ${args.join(" ")} failed.`);
}

if (spawnSync("docker", ["info"], { stdio: "ignore" }).status !== 0) {
  throw new Error(
    "Open Docker Desktop with Linux containers enabled, then run npm run local:start again.",
  );
}
if (!existsSync("node_modules/next/dist/bin/next")) {
  run(["ci", "--cache", path.join(os.tmpdir(), "pibardos-npm-cache")]);
}
console.log("Starting and verifying local Supabase…");
run(["run", "db:start"], true);
const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const hasKey = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
if (hasUrl !== hasKey)
  throw new Error(
    "Provide both public Supabase connection variables, or clear the partial binding to use local setup.",
  );
if (!existsSync(".env.local") && !hasUrl) run(["run", "setup:local"]);

async function ready() {
  try {
    const response = await fetch(`${url}/api/health`, {
      signal: AbortSignal.timeout(2000),
    });
    const body = await response.json();
    const login = await fetch(`${url}/login`, {
      signal: AbortSignal.timeout(2000),
    });
    const html = await login.text();
    return (
      response.ok &&
      body.application === "pibardos-op" &&
      body.status === "ok" &&
      login.ok &&
      html.includes('name="email"') &&
      html.includes('name="password"')
    );
  } catch {
    return false;
  }
}

function openBrowser() {
  console.log(
    `Open ${url} in this computer's browser. Local accounts and data stay on this computer.`,
  );
  if (process.env.PIBARDOS_OPEN_BROWSER === "false") return;
  const command =
    process.platform === "win32"
      ? "powershell.exe"
      : process.platform === "darwin"
        ? "open"
        : "xdg-open";
  // URL is constructed solely from a validated numeric port, never arbitrary shell input.
  const args =
    process.platform === "win32"
      ? ["-NoProfile", "-NonInteractive", "-Command", `Start-Process '${url}'`]
      : [url];
  const opener = spawn(command, args, { stdio: "ignore" });
  opener.on("error", () =>
    console.log(
      "Automatic browser opening is unavailable; open the URL above manually.",
    ),
  );
}

if (await ready()) {
  console.log("The app is already running.");
  openBrowser();
} else {
  // A local production build enables the PWA without a deployment or dev-server lock.
  run(["run", "build"]);
  const app = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { cwd: root, stdio: "inherit" },
  );
  let failure;
  app.on("error", (error) => {
    failure = error;
  });
  process.on("SIGINT", () => app.kill("SIGINT"));
  process.on("SIGTERM", () => app.kill("SIGTERM"));
  const deadline = Date.now() + 60000;
  let isReady = false;
  while (Date.now() < deadline && !failure && app.exitCode === null) {
    if (await ready()) {
      isReady = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!isReady) {
    app.kill("SIGTERM");
    throw (
      failure ??
      new Error(`The app did not start. Check that port ${port} is available.`)
    );
  }
  console.log(
    "The app is ready. Keep this terminal open; Ctrl+C stops the web server.",
  );
  openBrowser();
  if (app.exitCode === null)
    await new Promise((resolve) => app.once("exit", resolve));
  // Supabase is retained. Stop it separately with npm run db:stop; never reset on exit.
}

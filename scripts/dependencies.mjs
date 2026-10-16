import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
export function ensureDependencies(root, install) {
  const digest = createHash("sha256")
    .update(readFileSync(path.join(root, "package-lock.json")))
    .digest("hex");
  const stamp = path.join(root, "node_modules/.pibardos-lock-sha256");
  if (
    !existsSync(path.join(root, "node_modules/next/dist/bin/next")) ||
    !existsSync(stamp) ||
    readFileSync(stamp, "utf8") !== digest
  ) {
    console.log("Restoring pinned dependencies for this lockfile…");
    install();
    writeFileSync(stamp, digest);
  }
}

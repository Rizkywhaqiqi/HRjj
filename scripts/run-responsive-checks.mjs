import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
const directory = "src/app/responsive-check";
let status = 1;
try {
  const setup = spawnSync(
    process.execPath,
    ["scripts/responsive-fixture.mjs"],
    { stdio: "inherit" },
  );
  if (setup.status !== 0)
    throw new Error("Could not prepare responsive fixtures");
  const result = spawnSync(
    process.execPath,
    ["node_modules/@playwright/test/cli.js", "test"],
    { stdio: "inherit" },
  );
  status = result.status ?? 1;
} finally {
  rmSync(directory, { recursive: true, force: true });
  // Discard dev route types that referenced the now-removed fixture pages.
  rmSync(".next/dev/types", { recursive: true, force: true });
}
process.exitCode = status;

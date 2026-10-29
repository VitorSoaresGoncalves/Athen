// Cross-platform launcher for the skill-link scripts, meant to run from the
// "prepare" npm lifecycle (i.e. automatically after `npm install`).
//
// It picks the right script for the OS:
//   Windows -> scripts/link-skills.ps1 (creates junctions, no admin needed)
//   others  -> scripts/link-skills.sh  (creates symlinks)
//
// It never fails the install: if linking can't happen (e.g. .agents/skills is
// absent, or PowerShell/bash isn't available), it warns and exits 0 so that
// `npm install` still succeeds.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "..");

// Nothing to link against? Skip quietly (e.g. skills not installed yet).
if (!existsSync(join(repoRoot, ".agents", "skills"))) {
  console.warn("[link-skills] .agents/skills not found; skipping skill links.");
  process.exit(0);
}

const isWindows = process.platform === "win32";
const command = isWindows ? "powershell" : "bash";
const args = isWindows
  ? ["-ExecutionPolicy", "Bypass", "-File", join(scriptDir, "link-skills.ps1")]
  : [join(scriptDir, "link-skills.sh")];

const result = spawnSync(command, args, { cwd: repoRoot, stdio: "inherit" });

if (result.error || result.status !== 0) {
  console.warn(
    "[link-skills] could not create skill links automatically. " +
      "Run the script in scripts/ manually if you want Claude Code / Kiro auto-discovery.",
  );
}

// Always succeed so install is never blocked by linking.
process.exit(0);

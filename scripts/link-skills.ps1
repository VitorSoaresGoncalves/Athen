# Recreate the per-tool skill links from the canonical .agents/skills source (Windows).
#
# Why: skills live once in .agents\skills\ (committed to git). Claude Code and
# Kiro auto-discover skills from their own folders (.claude\skills, .kiro\skills),
# so we recreate those as directory junctions pointing back at the canonical
# source. Links are not committed, so every dev runs this once after cloning.
#
# Junctions are used (not symlinks) because they do NOT require admin rights or
# Developer Mode on Windows.
#
# Usage (from anywhere):
#   powershell -ExecutionPolicy Bypass -File scripts\link-skills.ps1
#
# Safe to re-run: it refreshes the links each time.
$ErrorActionPreference = "Stop"

# Repo root = parent of this script's folder.
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$src = Join-Path $root ".agents\skills"
if (-not (Test-Path $src)) {
  Write-Error "'.agents\skills' not found. Run this from the repo and make sure skills are installed."
  exit 1
}

function Link-One([string]$destDir) {
  $parent = Split-Path -Parent $destDir
  if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent | Out-Null }

  # Remove any previous link/dir so we start clean.
  if (Test-Path $destDir) { Remove-Item -Recurse -Force $destDir }

  # Junction needs an absolute target.
  New-Item -ItemType Junction -Path $destDir -Target $src | Out-Null
  Write-Output "linked $destDir -> $src"
}

Link-One (Join-Path $root ".claude\skills")
Link-One (Join-Path $root ".kiro\skills")

Write-Output "Done. Claude Code and Kiro will now auto-discover skills from .agents\skills\."

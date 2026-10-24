#!/usr/bin/env bash
# Recreate the per-tool skill links from the canonical .agents/skills source.
#
# Why: skills live once in .agents/skills/ (committed to git). Claude Code and
# Kiro auto-discover skills from their own folders (.claude/skills, .kiro/skills),
# so we recreate those as symlinks pointing back at the canonical source. Links
# are not committed (git can't carry them reliably across OSes), so every dev
# runs this once after cloning.
#
# Usage (from the repo root):
#   bash scripts/link-skills.sh
#
# Safe to re-run: it refreshes the links each time.
set -euo pipefail

# Move to the repo root (the parent of this script's directory).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SRC=".agents/skills"
if [ ! -d "$SRC" ]; then
  echo "error: $SRC not found. Run this from the repo and make sure skills are installed." >&2
  exit 1
fi

link_one() {
  # $1 = destination skills dir, e.g. .claude/skills
  local dest_dir="$1"
  local parent
  parent="$(dirname "$dest_dir")"
  mkdir -p "$parent"

  # Remove any previous link/dir so we start clean.
  if [ -L "$dest_dir" ] || [ -e "$dest_dir" ]; then
    rm -rf "$dest_dir"
  fi

  # Relative target so the link works regardless of where the repo is cloned.
  # .claude/skills -> ../.agents/skills ; .kiro/skills -> ../.agents/skills
  ln -s "../.agents/skills" "$dest_dir"
  echo "linked $dest_dir -> ../.agents/skills"
}

link_one ".claude/skills"
link_one ".kiro/skills"

echo "Done. Claude Code and Kiro will now auto-discover skills from .agents/skills/."

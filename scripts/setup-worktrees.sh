#!/usr/bin/env bash
# setup-worktrees.sh — One-time setup: create all 7 feature worktrees and install
#                      dependencies. Safe to re-run (skips existing worktrees).
#
# Usage (from repo root):
#   bash scripts/setup-worktrees.sh
#
# Prerequisites:
#   - Repo cloned and you are inside it
#   - Node.js / npm installed
#   - A .env file exists in the repo root containing at least GITHUB_PAT=...
#     (copy .env.example and fill it in if you haven't already)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║    SAS → HiveQL  •  Worktree Setup                   ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── 1. Verify we are inside the git repo root ───────────────────────────────
if ! git -C "$ROOT" rev-parse --git-dir &>/dev/null; then
  echo "ERROR: $ROOT is not a git repository." >&2
  exit 1
fi

# ── 2. Check / create root .env ─────────────────────────────────────────────
ENV_FILE="$ROOT/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "No .env found in repo root."
  read -rp "  Enter your GITHUB_PAT: " pat
  if [[ -z "$pat" ]]; then
    echo "ERROR: GITHUB_PAT is required." >&2
    exit 1
  fi
  printf "GITHUB_PAT=%s\nPORT=3001\nVITE_PORT=5173\n" "$pat" > "$ENV_FILE"
  echo "  Created .env"
else
  echo "▸ Root .env found — using existing file."
fi

# Extract PAT from root .env (handles lines with or without quotes)
GITHUB_PAT=$(grep -E '^GITHUB_PAT=' "$ENV_FILE" | head -1 | cut -d'=' -f2- | tr -d '"'"'" )
if [[ -z "$GITHUB_PAT" ]]; then
  echo "ERROR: GITHUB_PAT not found in $ENV_FILE" >&2
  exit 1
fi
echo ""

# ── 3. Feature worktree definitions ─────────────────────────────────────────
# Format: "slug|branch|server-port|vite-port"
declare -a FEATURES=(
  "feat-1|feature/conversational-followup|3011|5181"
  "feat-2|feature/pattern-library|3012|5182"
  "feat-3|feature/confidence-scoring|3013|5183"
  "feat-4|feature/line-mapping|3014|5184"
  "feat-5|feature/dialect-selector|3015|5185"
  "feat-6|feature/domain-context|3016|5186"
  "feat-7|feature/view-modes|3017|5187"
)

# ── 4. Fetch remote branches ─────────────────────────────────────────────────
echo "▸ Fetching remote branches..."
git -C "$ROOT" fetch --all --quiet
echo "  Done."
echo ""

# ── 5. Create worktrees + .env + npm install ─────────────────────────────────
TREES_DIR="$ROOT/.trees"
mkdir -p "$TREES_DIR"

for entry in "${FEATURES[@]}"; do
  IFS='|' read -r slug branch port vite_port <<< "$entry"
  tree_path="$TREES_DIR/$slug"

  echo "▸ [$slug]  branch: $branch  (server :$port  client :$vite_port)"

  # Create worktree (skip if already present)
  if git -C "$ROOT" worktree list | grep -qF "$tree_path"; then
    echo "  Worktree already exists — skipping git worktree add."
  else
    git -C "$ROOT" worktree add "$tree_path" "$branch" --quiet
    echo "  Worktree created."
  fi

  # Write .env into the worktree root (always overwrite so ports stay correct)
  cat > "$tree_path/.env" <<EOF
GITHUB_PAT=${GITHUB_PAT}
PORT=${port}
VITE_PORT=${vite_port}
EOF
  echo "  .env written (PORT=${port}, VITE_PORT=${vite_port})."

  # Install dependencies
  echo "  Running npm install..."
  npm install --prefix "$tree_path" --silent
  echo "  Dependencies installed."
  echo ""
done

# ── 6. Make sure root deps are installed too ─────────────────────────────────
echo "▸ Installing root / main app dependencies..."
npm install --prefix "$ROOT" --silent
echo "  Done."
echo ""

echo "╔══════════════════════════════════════════════════════╗"
echo "║  Setup complete!  All 7 worktrees are ready.         ║"
echo "║                                                      ║"
echo "║  Start the full demo:                                ║"
echo "║    bash scripts/start-demo.sh                        ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

#!/usr/bin/env bash
# start-demo.sh — Start all 7 feature worktrees and open the demo navigator

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║        SAS → HiveQL  •  Feature Demo Launcher        ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Kill any stale processes on the feature ports
echo "▸ Clearing ports..."
for port in 3001 3011 3012 3013 3014 3015 3016 3017 5173 5181 5182 5183 5184 5185 5186 5187; do
  lsof -ti :"$port" | xargs kill -9 2>/dev/null || true
done
echo "  Ports cleared."
echo ""

# Open the demo navigator immediately (servers take a few seconds to start)
echo "▸ Opening demo navigator..."
open "$ROOT/demo/index.html"
echo ""

echo "▸ Starting main app + all 7 feature servers (this terminal stays live)..."
echo "  Servers will appear once Vite is ready."
echo "  Press Ctrl+C to stop everything."
echo ""

cd "$ROOT"

npx concurrently \
  --kill-others-on-fail \
  --prefix-colors "white.bold,cyan.bold,green.bold,yellow.bold,blue.bold,magenta.bold,red.bold,gray.bold" \
  --names "main,feat-1,feat-2,feat-3,feat-4,feat-5,feat-6,feat-7" \
  "npm run dev" \
  "cd .trees/feat-1 && npm run dev" \
  "cd .trees/feat-2 && npm run dev" \
  "cd .trees/feat-3 && npm run dev" \
  "cd .trees/feat-4 && npm run dev" \
  "cd .trees/feat-5 && npm run dev" \
  "cd .trees/feat-6 && npm run dev" \
  "cd .trees/feat-7 && npm run dev"

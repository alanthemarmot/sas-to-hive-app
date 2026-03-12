#!/usr/bin/env bash
# stop-demo.sh — Kill all demo server processes (main + all 7 feature worktrees)

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║        SAS → HiveQL  •  Demo Shutdown                ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

echo "▸ Stopping all servers..."

PORTS=(3001 3011 3012 3013 3014 3015 3016 3017 5173 5181 5182 5183 5184 5185 5186 5187)
KILLED=0

for port in "${PORTS[@]}"; do
  pids=$(lsof -ti :"$port" 2>/dev/null)
  if [[ -n "$pids" ]]; then
    echo "  Killing port $port (PID $pids)"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    KILLED=$((KILLED + 1))
  fi
done

if [[ $KILLED -eq 0 ]]; then
  echo "  Nothing was running."
else
  echo ""
  echo "  Stopped $KILLED process(es)."
fi

echo ""
echo "  Done. All demo servers shut down."
echo ""

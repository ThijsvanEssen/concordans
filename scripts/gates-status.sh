#!/usr/bin/env bash
# Who runs the gates on this machine: the holder of the lock (scripts/gates.sh) and the runs
# waiting for it, each with its worktree and how long it has run, plus the load.
set -euo pipefail
LOCK="${TMPDIR:-/tmp}/concordans-gates.lock"
echo "load: $(uptime | sed 's/.*load averages*: //')"
holder=$(cat "$LOCK/pid" 2>/dev/null || true)
echo "lock: ${holder:-free}"
for pid in $(pgrep -f "scripts/gates.sh" || true); do
  dir=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')
  state=waiting
  [ "$pid" = "$holder" ] && state=running
  step=$(pgrep -P "$pid" -fl 2>/dev/null | grep -o -E 'vitest|svelte-check|check:e2e|playwright|eslint|prettier|eenvoud' | head -1 || true)
  echo "$state  $(basename "$dir")  $(ps -o etime= -p "$pid" | tr -d ' ')  ${step:-}"
done

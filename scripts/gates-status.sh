#!/usr/bin/env bash
# Who runs the gates on this machine: the holder of the lock (scripts/gates.sh) and the runs
# waiting for it, each with its worktree and how long it has run, plus the load.
set -euo pipefail
LOCK="${TMPDIR:-/tmp}/concordans-gates.lock"
echo "load: $(uptime | sed 's/.*load averages*: //')"
holder=$(cat "$LOCK/pid" 2>/dev/null || true)
echo "lock: ${holder:-free}"
holder_dir=""
[ -n "$holder" ] && holder_dir=$(lsof -a -p "$holder" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')
# One line per worktree: a run starts as npm, sh and bash with the same command line, and its
# light gates run in subshells of it.
seen=" "
for pid in $(pgrep -f "scripts/gates.sh" || true); do
  dir=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')
  case "$seen" in *" $dir "*) continue ;; esac
  seen="$seen$dir "
  state=waiting
  [ "$dir" = "$holder_dir" ] && state=running
  echo "$state  $(basename "$dir")  $(ps -o etime= -p "$pid" | tr -d ' ')"
done

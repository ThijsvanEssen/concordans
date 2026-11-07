#!/usr/bin/env bash
# Every gate before a merge, as CI runs them, stopping at the first that fails. ESLint keeps
# its cache in .eslintcache, so a second run lints only what changed.
set -euo pipefail
# The visual baseline below needs Docker: say so now, not after the wait and the other gates.
bash scripts/e2e-docker.sh
# Every gate one run at a time on this machine: the agents of several worktrees otherwise run them side
# by side, the machine swaps and the browser suite times out (30 okt: the light gates of one run beside
# the browser suite of another). A run waits for the lock; a lock whose holder is gone is taken over.
LOCK="${TMPDIR:-/tmp}/concordans-gates.lock"
until mkdir "$LOCK" 2>/dev/null; do
  holder=$(cat "$LOCK/pid" 2>/dev/null || true)
  if [ -n "$holder" ] && ! kill -0 "$holder" 2>/dev/null; then rm -rf "$LOCK"; continue; fi
  echo "gates: waiting for the gates of another worktree (pid ${holder:-?})"
  sleep 20
done
echo $$ > "$LOCK/pid"
date +%s > "$LOCK/since"

# Each gate runs as a step: in a process group of its own, with a fixed deadline in seconds. A step
# that runs over is stopped whole, its workers too, and the run ends red with its name, so a hung
# test never holds the lock (6 and 7 nov: vitest hung for hours, once on an orphaned worker after a
# red test, once on an endless loop in a test). The holder writes its step beside its pid, for
# scripts/gates-status.sh.
child=""
# The processes under $1, also those that left its group (Playwright starts its web server detached).
descendants() {
  local c
  for c in $(pgrep -P "$1" || true); do
    echo "$c"
    descendants "$c"
  done
}
# Stops the group of $1 and every process under it: TERM, ten seconds to go, then KILL.
stop_group() {
  local tree _
  tree=$(descendants "$1")
  # shellcheck disable=SC2086
  kill -TERM -- "-$1" $tree 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    pgrep -g "$1" >/dev/null || break
    sleep 1
  done
  # shellcheck disable=SC2086
  kill -KILL -- "-$1" $tree 2>/dev/null || true
}
step() {
  local name=$1 limit=$2 start=$SECONDS rc=0
  shift 2
  echo "$name $(date +%s) $limit" >"$LOCK/step"
  perl -e 'setpgrp(0, 0); exec @ARGV or die "gates: $ARGV[0]: $!\n"' "$@" </dev/null &
  child=$!
  while kill -0 "$child" 2>/dev/null; do
    if ((SECONDS - start >= limit)); then
      echo "gates: $name ran over its ${limit}s, stopped with every process it started" >&2
      stop_group "$child"
      wait "$child" 2>/dev/null || true
      child=""
      return 124
    fi
    sleep 1
  done
  wait "$child" || rc=$?
  child=""
  echo "gates: $name $([ "$rc" -eq 0 ] && echo passed || echo "failed (rc $rc)") in $((SECONDS - start))s"
  return "$rc"
}
cleanup() {
  [ -n "$child" ] && stop_group "$child"
  rm -rf "$LOCK"
}
trap cleanup EXIT
trap 'echo "gates: stopped" >&2; exit 130' INT TERM HUP

# The light gates side by side: ESLint, the simplicity budget (eenvoud-budget.json: nothing rose,
# and what fell is written down) and Prettier. Each writes its own log, shown when it ends; one
# that fails fails the step.
light() {
  local dir failed=0 gate pid_eslint pid_eenvoud pid_prettier pid
  dir=$(mktemp -d)
  npx eslint --cache . >"$dir/eslint" 2>&1 &
  pid_eslint=$!
  scripts/eenvoud.sh >"$dir/eenvoud" 2>&1 &
  pid_eenvoud=$!
  git ls-files -z -- . ':!.claude/launch.json' | xargs -0 npx prettier --check --ignore-unknown >"$dir/prettier" 2>&1 &
  pid_prettier=$!
  for gate in eslint eenvoud prettier; do
    pid="pid_$gate"
    if ! wait "${!pid}"; then failed=1; echo "gates: $gate failed"; fi
    cat "$dir/$gate"
  done
  rm -rf "$dir"
  [ "$failed" -eq 0 ]
}
export -f light

step types:api 180 npm run types:api
git diff --exit-code -- src/lib/api/generated
step light 600 bash -c light
step vitest 600 npx vitest run
step check 600 npm run check
step check:e2e 300 npm run check:e2e
# The browser suite builds and serves the app itself (playwright.config.ts), so the build is checked there.
step e2e 1800 npm run e2e
# The visual baseline, which the browser suite above skips off Linux, as CI runs it. Never writes a
# snapshot; a change on purpose: scripts/e2e-docker.sh 'npx playwright test e2e/visueel.spec.ts --update-snapshots=changed'.
step visueel 1800 bash scripts/e2e-docker.sh 'CI=1 npx playwright test e2e/visueel.spec.ts --update-snapshots=none --reporter=list'

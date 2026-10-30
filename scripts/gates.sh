#!/usr/bin/env bash
# Every gate before a merge, as CI runs them, stopping at the first that fails. ESLint keeps
# its cache in .eslintcache, so a second run lints only what changed.
set -euo pipefail
npm run types:api
git diff --exit-code -- src/lib/api/generated
npx eslint --cache .
# The simplicity budget (eenvoud-budget.json): nothing rose, and what fell is written down.
scripts/eenvoud.sh
git ls-files -z -- . ':!.claude/launch.json' | xargs -0 npx prettier --check --ignore-unknown
# The heavy gates (vitest, svelte-check, build, the browser suite) one run at a time on this machine: the
# agents of several worktrees otherwise run them side by side and the machine swaps. A run waits for the
# lock; a lock whose holder is gone is taken over.
LOCK="${TMPDIR:-/tmp}/concordans-gates.lock"
until mkdir "$LOCK" 2>/dev/null; do
  holder=$(cat "$LOCK/pid" 2>/dev/null || true)
  if [ -n "$holder" ] && ! kill -0 "$holder" 2>/dev/null; then rm -rf "$LOCK"; continue; fi
  echo "gates: waiting for the heavy gates of another worktree (pid ${holder:-?})"
  sleep 20
done
echo $$ > "$LOCK/pid"
trap 'rm -rf "$LOCK"' EXIT
npx vitest run
npm run check
npm run check:e2e
# The browser suite builds and serves the app itself (playwright.config.ts), so the build is checked there.
npm run e2e

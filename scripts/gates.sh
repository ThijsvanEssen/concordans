#!/usr/bin/env bash
# Every gate before a merge, as CI runs them, stopping at the first that fails. ESLint keeps
# its cache in .eslintcache, so a second run lints only what changed.
set -euo pipefail
npm run types:api
git diff --exit-code -- src/lib/api/generated
npx eslint --cache .
git ls-files -z -- . ':!.claude/launch.json' | xargs -0 npx prettier --check --ignore-unknown
npx vitest run
npm run check
npm run build

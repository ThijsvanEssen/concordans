#!/usr/bin/env bash
# The API fixtures of the browser suite (e2e/api/), recorded from the live API: the suite runs
# with E2E_RECORD=1, and every request without its file is asked of E2E_LIVE_API (default
# https://concordans.nl) and written down. Without arguments the fixtures are made anew, so
# what no test asks any more goes; with arguments (a spec, -g …) only what is missing is added.
set -euo pipefail
cd "$(dirname "$0")/.."
[ $# -eq 0 ] && rm -rf e2e/api
E2E_RECORD=1 npx playwright test "$@"

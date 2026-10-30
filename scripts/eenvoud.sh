#!/usr/bin/env bash
# The simplicity budget: eenvoud.mjs measures and compares with eenvoud-budget.json (a ratchet).
# Usage: scripts/eenvoud.sh [--write | --raised REF]
set -euo pipefail
exec node "$(dirname "$0")/eenvoud.mjs" "$@"

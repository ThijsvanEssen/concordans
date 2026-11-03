#!/usr/bin/env bash
# Records the API fixtures anew (e2e-record.sh), then the visual baseline (e2e/snapshots/) in
# the Playwright image that CI runs the suite in (e2e-docker.sh). Needs Docker.
set -euo pipefail
cd "$(dirname "$0")/.."
bash scripts/e2e-record.sh
bash scripts/e2e-docker.sh 'E2E_RECORD=1 npx playwright test e2e/visueel.spec.ts --update-snapshots=changed'

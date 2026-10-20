#!/usr/bin/env bash
# Records the API fixtures anew (e2e-record.sh), then the visual baseline (e2e/snapshots/) in
# the Playwright image that CI runs the suite in, so the pixels are those of CI. Needs Docker.
set -euo pipefail
cd "$(dirname "$0")/.."
bash scripts/e2e-record.sh
version=$(node -p "require('@playwright/test/package.json').version")
docker run --rm --ipc=host -v "$PWD":/work -v /work/node_modules -w /work -e E2E_RECORD=1 \
	"mcr.microsoft.com/playwright:v${version}-noble" \
	bash -c 'npm ci --no-audit --no-fund --loglevel=error && npx playwright test e2e/visueel.spec.ts --update-snapshots=changed'

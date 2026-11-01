#!/usr/bin/env bash
# Runs a command in the Playwright image that CI runs the suite in, so the pixels are those of
# CI: the image of the local @playwright/test, on this worktree, with a node_modules and a
# .svelte-kit of its own. Without a command it only checks that Docker runs.
set -euo pipefail
cd "$(dirname "$0")/.."
if ! docker info >/dev/null 2>&1; then
	echo "e2e-docker: Docker is not running, and the visual baseline (e2e/visueel.spec.ts) needs it." >&2
	echo "e2e-docker: start Docker Desktop (open -a Docker), wait until it is up, and run this again." >&2
	exit 1
fi
[ $# -eq 0 ] && exit 0
version=$(node -p "require('@playwright/test/package.json').version")
docker run --rm --ipc=host -v "$PWD":/work -v /work/node_modules -v /work/.svelte-kit -w /work \
	"mcr.microsoft.com/playwright:v${version}-noble" \
	bash -c "npm ci --no-audit --no-fund --loglevel=error && $1"

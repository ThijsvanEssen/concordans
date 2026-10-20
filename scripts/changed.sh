#!/usr/bin/env bash
# The files of this checkout that differ from where it left origin/main (committed, staged,
# unstaged and new; deleted files left out), for quick work before the full gates:
#   lint  prettier --check and ESLint (cache in .eslintcache) over those files
#   test  the vitest tests that import those under src/ (vitest related; a changed package.json
#         or lock file would rerun them all, which the full gates do)
set -euo pipefail
base=$(git merge-base origin/main HEAD)
list=$(git diff --name-only --diff-filter=d "$base" && git ls-files --others --exclude-standard)
files=()
while IFS= read -r f; do [ -n "$f" ] && files+=("$f"); done <<< "$list"
[ ${#files[@]} -eq 0 ] && exit 0
case "${1:-}" in
	lint)
		npx prettier --check --ignore-unknown "${files[@]}"
		npx eslint --cache --no-warn-ignored "${files[@]}"
		;;
	test)
		src=()
		for f in "${files[@]}"; do case "$f" in src/*) src+=("$f") ;; esac; done
		[ ${#src[@]} -eq 0 ] && exit 0
		npx vitest related --run --passWithNoTests "${src[@]}"
		;;
	*)
		echo "usage: $0 lint|test" >&2
		exit 2
		;;
esac

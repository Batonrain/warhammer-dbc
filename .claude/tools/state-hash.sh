#!/usr/bin/env bash
# Deterministic fingerprint (a git tree SHA) of the CURRENT working-tree state
# for the given pathspecs, WITHOUT touching the real index or working tree.
# Used by pr-reviewer (to stamp what it reviewed) and git-scribe (to check
# whether that stamp is still fresh before proposing a push).
#
#   .claude/tools/state-hash.sh <pathspec...>   # e.g. module warhammer-dbc.mjs packs-src
#
# No pathspec given -> whole tree (HEAD + all tracked/untracked changes).
# Adapted from a shared agent-bundle template; secrets/signature machinery
# dropped on purpose — this project has no cooperative-agent forgery concern,
# it only needs "did the reviewed paths change since review".
set -euo pipefail
root="$(git rev-parse --show-toplevel)"; cd "$root"
tmpi="$(mktemp)"; trap 'rm -f "$tmpi"' EXIT
export GIT_INDEX_FILE="$tmpi"
if [ "$#" -gt 0 ]; then
  # Scoped fingerprint: empty index, stage ONLY the given paths, so the result
  # depends solely on their current content (not folded into the whole HEAD
  # tree - an out-of-scope change must not shift this hash).
  git read-tree --empty
  paths=()
  for p in "$@"; do [ -e "$p" ] && paths+=("$p"); done
  [ "${#paths[@]}" -gt 0 ] && git -c core.autocrlf=false add -A -- "${paths[@]}" 2>/dev/null
else
  git read-tree HEAD 2>/dev/null || git read-tree --empty
  git -c core.autocrlf=false add -A 2>/dev/null
fi
git write-tree

#!/usr/bin/env bash
# Keep docs/FILE.md in sync with src/: every added src file must have an entry,
# and every deleted src file must no longer have one. Matches the file's exact
# repo-relative path as a literal string, so FILE.md entries must spell the path
# out in full. Renames count as a delete of the old path + an add of the new.

FILE_DOC="docs/FILE.md"

is_source() {
  case "$1" in
    src/*) return 0 ;;
  esac
  return 1
}

# A path "has an entry" if it appears verbatim anywhere in FILE.md.
has_entry() {
  [ -f "$FILE_DOC" ] && grep -qF -- "$1" "$FILE_DOC"
}

missing=""
stale=""

require_documented() {
  is_source "$1" || return 0
  has_entry "$1" || missing="$missing  $1"$'\n'
}

require_absent() {
  is_source "$1" || return 0
  has_entry "$1" && stale="$stale  $1"$'\n'
}

# --name-status emits one record per change: a status code then tab-separated
# paths. A/M carry one path; R/C carry old then new. New side must be
# documented; old side must not be.
while IFS=$'\t' read -r status p1 p2; do
  case "$status" in
    A*) require_documented "$p1" ;;
    D*) require_absent "$p1" ;;
    R*|C*) require_absent "$p1"; require_documented "$p2" ;;
  esac
done < <(git diff --cached --name-status -M)

fail=0
if [ -n "$missing" ]; then
  echo "✖ New src files missing a $FILE_DOC entry (add their full path + a description):"
  printf '%s' "$missing"
  fail=1
fi
if [ -n "$stale" ]; then
  echo "✖ Deleted src files still listed in $FILE_DOC (remove their entry):"
  printf '%s' "$stale"
  fail=1
fi

exit $fail

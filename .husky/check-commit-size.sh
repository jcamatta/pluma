#!/usr/bin/env bash
# Enforce a commit size budget so changes stay small and reviewable.
# Only files under src/ carry weight; everything else (docs, config, scripts,
# the e2e harness, lockfiles, generated output) counts as zero.

MAX_WEIGHTED_LINES=300
MAX_SOURCE_FILES=15
MIN_LINES_REQUIRING_TESTS=30

is_source() {
  case "$1" in
    src/*) return 0 ;;
  esac
  return 1
}

is_test() {
  case "$1" in
    *.test.*|*.spec.*|*__tests__*|*.e2e.*) return 0 ;;
  esac
  return 1
}

weighted=0
source_files=0
test_lines=0

while IFS=$'\t' read -r added deleted file; do
  [ "$added" = "-" ] && continue # binary
  is_source "$file" || continue
  lines=$((added + deleted))
  if is_test "$file"; then
    test_lines=$((test_lines + lines))
  else
    weighted=$((weighted + lines))
    source_files=$((source_files + 1))
  fi
done < <(git diff --cached --numstat)

fail=0
if [ "$weighted" -gt "$MAX_WEIGHTED_LINES" ]; then
  echo "✖ Commit too large: $weighted source lines (max $MAX_WEIGHTED_LINES). Split it."
  fail=1
fi
if [ "$source_files" -gt "$MAX_SOURCE_FILES" ]; then
  echo "✖ Too many source files: $source_files (max $MAX_SOURCE_FILES)."
  fail=1
fi
if [ "$weighted" -gt "$MIN_LINES_REQUIRING_TESTS" ] && [ "$test_lines" -eq 0 ]; then
  echo "✖ $weighted source lines changed with no test changes. Add/update tests or split."
  fail=1
fi

exit $fail

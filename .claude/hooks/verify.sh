#!/usr/bin/env bash
# stickly Stop hook: runs lint + type-check + tests (same as CI) at the
# end of each turn, but only if the code changed since the last successful
# verification. If something fails, it exits with code 2: Claude gets the
# error and keeps fixing.

set -uo pipefail

MAX_ATTEMPTS=3
STATE_DIR="$CLAUDE_PROJECT_DIR/.claude"
STATE_FILE="$STATE_DIR/.verify-state"
ATTEMPTS_FILE="$STATE_DIR/.verify-attempts"
# Code, schema, translations and the config the checks depend on
WATCHED=(src tests prisma messages package.json package-lock.json tsconfig.json
  eslint.config.mjs vitest.config.mts next.config.ts prisma7.config.ts)

cd "$CLAUDE_PROJECT_DIR" || exit 0

input=$(cat)
stop_hook_active=$(printf '%s' "$input" | node -e '
  let d = ""; process.stdin.on("data", c => d += c).on("end", () => {
    try { console.log(JSON.parse(d).stop_hook_active ? "1" : "0"); }
    catch { console.log("0"); }
  });')

# Fingerprint of the current code state (tracked changes + new files)
current_state=$( {
  git diff HEAD -- "${WATCHED[@]}" 2>/dev/null
  git ls-files -z --others --exclude-standard -- "${WATCHED[@]}" | xargs -0 -r cat
} | sha1sum | cut -d' ' -f1 )

# No changes since the last green verification: nothing to do
if [[ -f "$STATE_FILE" && "$(cat "$STATE_FILE")" == "$current_state" ]]; then
  rm -f "$ATTEMPTS_FILE"
  exit 0
fi

# Cap attempts to avoid an infinite loop of fixes
if [[ "$stop_hook_active" == "1" ]]; then
  attempts=$(( $(cat "$ATTEMPTS_FILE" 2>/dev/null || echo 0) + 1 ))
else
  attempts=1
fi
echo "$attempts" > "$ATTEMPTS_FILE"

if (( attempts > MAX_ATTEMPTS )); then
  rm -f "$ATTEMPTS_FILE"
  echo "verify.sh: reached the maximum of $MAX_ATTEMPTS attempts; run the checks manually." >&2
  exit 0
fi

failures=""
run_check() {
  local name="$1"; shift
  local output
  if ! output=$("$@" 2>&1); then
    failures+=$'\n'"### $name failed"$'\n'"$(printf '%s' "$output" | tail -n 60)"$'\n'
  fi
}

run_check "lint"       npm run lint --silent
run_check "type-check" npm run type-check --silent
run_check "tests"      npm test --silent

if [[ -n "$failures" ]]; then
  {
    echo "The CI checks failed after your changes. Fix them before finishing:"
    echo "$failures"
  } >&2
  exit 2
fi

echo "$current_state" > "$STATE_FILE"
rm -f "$ATTEMPTS_FILE"
exit 0

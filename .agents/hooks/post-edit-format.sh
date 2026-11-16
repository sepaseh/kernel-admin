#!/bin/bash
# Optional post-edit helper for AI tools that provide JSON on stdin or in $INPUT.
# It runs ESLint auto-fix on edited TypeScript/JavaScript files when available.

command -v node >/dev/null 2>&1 || exit 0

if [[ -z "${INPUT:-}" && ! -t 0 ]]; then
  INPUT=$(cat)
fi

FILE_PATH=$(printf '%s' "${INPUT:-}" | node -e '
try {
  const payload = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
  const file = payload?.tool_input?.file_path ?? payload?.file_path;
  if (typeof file === "string" && !/[\r\n\0]/.test(file)) process.stdout.write(file);
} catch {}
' 2>/dev/null)

PROJECT_DIR=${AI_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}
if [[ -z "$PROJECT_DIR" ]]; then
  exit 0
fi

cd -- "$PROJECT_DIR" || exit 0
ESLINT_CLI="node_modules/eslint/bin/eslint.js"

if [[ -z "$FILE_PATH" || ! -f "$FILE_PATH" || ! -f "$ESLINT_CLI" ]]; then
  exit 0
fi

case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx)
    node "$ESLINT_CLI" --fix -- "$FILE_PATH" >/dev/null 2>&1 || true
    ;;
  *)
    exit 0
    ;;
esac

exit 0

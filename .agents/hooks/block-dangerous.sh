#!/bin/bash
# Optional safety hook for AI tools that pass JSON tool input on stdin.
# Delegates raw input to the portable Node guard and preserves its exit status.

NODE_BIN=$(command -v node 2>/dev/null || command -v node.exe 2>/dev/null || true)
if [ -z "$NODE_BIN" ]; then
  echo "Safety hook requires Node.js; input cannot be inspected, so the command is blocked." >&2
  exit 2
fi

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd) || exit 2
SCRIPT_PATH="$SCRIPT_DIR/block-dangerous.mjs"
case "$NODE_BIN" in
  *.exe)
    if command -v wslpath >/dev/null 2>&1; then
      SCRIPT_PATH=$(wslpath -w "$SCRIPT_PATH") || exit 2
    elif command -v cygpath >/dev/null 2>&1; then
      SCRIPT_PATH=$(cygpath -w "$SCRIPT_PATH") || exit 2
    fi
    ;;
esac

exec "$NODE_BIN" "$SCRIPT_PATH"

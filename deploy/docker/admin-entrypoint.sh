#!/bin/sh
set -eu

fail() {
  printf '%s\n' "Invalid admin configuration: $1" >&2
  exit 1
}

case "${ADMIN_HOST:-}" in
  ''|*[!a-z0-9.-]*) fail "ADMIN_HOST must be a lowercase bare DNS hostname." ;;
  *)
    [ "${#ADMIN_HOST}" -le 253 ] &&
      printf '%s\n' "$ADMIN_HOST" |
        LC_ALL=C grep -Eq '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$' ||
      fail "ADMIN_HOST must be a lowercase bare DNS hostname."
    ;;
esac

case "${VITE_RELEASE_ID:-}" in
  example-unreleased|replace-release-id|replace-with-immutable-release-id)
    fail "VITE_RELEASE_ID must be replaced with an immutable release identifier." ;;
  ''|*[!A-Za-z0-9_.-]*|*..*) fail "VITE_RELEASE_ID contains unsafe characters." ;;
  *)
    printf '%s\n' "$VITE_RELEASE_ID" |
      LC_ALL=C grep -Eq '^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$' ||
      fail "VITE_RELEASE_ID must contain 1 to 128 safe release identifier characters."
    ;;
esac

printf '%s\n' "${VITE_APP_BASE_URL:-}" |
  LC_ALL=C grep -Eq '^/([A-Za-z0-9_-]+/)*$' ||
  fail "VITE_APP_BASE_URL must be a slash-delimited path ending in /."

nginx -t
exec "$@"

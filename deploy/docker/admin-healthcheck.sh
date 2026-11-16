#!/bin/sh
set -eu

nginx -t
response=$(curl --disable --fail --silent --show-error \
  --noproxy '*' --proto '=https' --max-redirs 0 \
  --connect-timeout 2 --max-time 5 \
  --cacert /etc/kernel-admin/tls/fullchain.pem \
  --resolve "${ADMIN_HOST:?ADMIN_HOST is required}:8443:127.0.0.1" \
  --write-out '|%{http_code}' \
  "https://${ADMIN_HOST}:8443${VITE_APP_BASE_URL:?VITE_APP_BASE_URL is required}_kernel/release")
expected=$(printf '{"release":"%s"}\n|200' "${VITE_RELEASE_ID:?VITE_RELEASE_ID is required}")
[ "$response" = "$expected" ] || {
  printf '%s\n' 'Admin HTTPS readiness response is invalid.' >&2
  exit 1
}

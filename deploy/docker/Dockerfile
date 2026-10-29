FROM node:24.18.0-bookworm-slim AS build
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 KERNEL_SYNTHETIC_ENV=1
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY src ./src
COPY public ./public
COPY tooling ./tooling
COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY scripts ./scripts
COPY deploy ./deploy
ARG VITE_API_BASE_URL
ARG VITE_APP_BASE_URL=/
ARG VITE_RELEASE_ID
ARG ADMIN_HOST
ARG PUBLIC_ASSET_ORIGIN
ARG VITE_OBSERVABILITY_URL
ARG HTTPS_PORT=443
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_APP_BASE_URL=${VITE_APP_BASE_URL} \
    VITE_RELEASE_ID=${VITE_RELEASE_ID} \
    VITE_OBSERVABILITY_URL=${VITE_OBSERVABILITY_URL}
RUN node scripts/validate-deployment-env.mjs \
    && npm run build \
    && node scripts/package-release.mjs --release="${VITE_RELEASE_ID}"
RUN ADMIN_HOST="${ADMIN_HOST}" \
    PUBLIC_ASSET_ORIGIN="${PUBLIC_ASSET_ORIGIN}" \
    HTTPS_PORT="${HTTPS_PORT}" \
    TLS_CERTIFICATE=/etc/kernel-admin/tls/fullchain.pem \
    TLS_CERTIFICATE_KEY=/etc/kernel-admin/tls/privkey.pem \
    ADMIN_ROOT=/usr/share/nginx/html \
    node --input-type=module -e ' \
      import {readFileSync,writeFileSync} from "node:fs"; \
      import {renderDeploymentTemplate} from "./scripts/render-deployment.mjs"; \
      const template = readFileSync("deploy/native/nginx/admin.conf.template","utf8"); \
      const rendered = renderDeploymentTemplate(template,process.env) \
        .replaceAll("listen 80", "listen 8080") \
        .replaceAll("listen 443", "listen 8443"); \
      writeFileSync("/app/admin.conf",rendered);'
RUN mkdir /app/release-public \
    && cp -a "/app/releases/${VITE_RELEASE_ID}/public/." /app/release-public/

FROM nginx:1.30.6-trixie
ARG ADMIN_HOST
ARG VITE_APP_BASE_URL=/
ARG VITE_RELEASE_ID
ENV ADMIN_HOST=${ADMIN_HOST} \
    VITE_APP_BASE_URL=${VITE_APP_BASE_URL} \
    VITE_RELEASE_ID=${VITE_RELEASE_ID}
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl openssl \
    && rm -rf /var/lib/apt/lists/* \
    && printf '%s\n' \
    'worker_processes auto;' \
    'pid /tmp/nginx.pid;' \
    'error_log /dev/stderr notice;' \
    'events { worker_connections 1024; }' \
    'http {' \
    '    include /etc/nginx/mime.types;' \
    '    default_type application/octet-stream;' \
    '    access_log /dev/stdout;' \
    '    sendfile on;' \
    '    keepalive_timeout 65;' \
    '    client_body_temp_path /tmp/client_temp;' \
    '    proxy_temp_path /tmp/proxy_temp;' \
    '    fastcgi_temp_path /tmp/fastcgi_temp;' \
    '    uwsgi_temp_path /tmp/uwsgi_temp;' \
    '    scgi_temp_path /tmp/scgi_temp;' \
    '    include /etc/nginx/conf.d/*.conf;' \
    '}' > /etc/nginx/nginx.conf
COPY --from=build /app/release-public/ /usr/share/nginx/html/
COPY --from=build /app/admin.conf /etc/nginx/conf.d/default.conf
USER nginx
EXPOSE 8080 8443
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
HEALTHCHECK --interval=30s --timeout=5s CMD curl --fail --silent \
    --cacert /etc/kernel-admin/tls/fullchain.pem \
    --resolve "${ADMIN_HOST}:8443:127.0.0.1" \
    "https://${ADMIN_HOST}:8443${VITE_APP_BASE_URL}_kernel/release" \
    | grep -F "\"release\":\"${VITE_RELEASE_ID}\"" || exit 1

FROM node:24.18.0-bookworm-slim AS build
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 KERNEL_SYNTHETIC_ENV=1
COPY package.json package-lock.json ./
RUN npm ci
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
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} VITE_APP_BASE_URL=${VITE_APP_BASE_URL} VITE_RELEASE_ID=${VITE_RELEASE_ID} VITE_OBSERVABILITY_URL=${VITE_OBSERVABILITY_URL}
RUN node scripts/validate-deployment-env.mjs && npm run build && node scripts/package-release.mjs --release=${VITE_RELEASE_ID}
RUN ADMIN_HOST=${ADMIN_HOST} PUBLIC_ASSET_ORIGIN=${PUBLIC_ASSET_ORIGIN} HTTPS_PORT=${HTTPS_PORT} TLS_CERTIFICATE=/etc/kernel-admin/tls/fullchain.pem TLS_CERTIFICATE_KEY=/etc/kernel-admin/tls/privkey.pem ADMIN_ROOT=/usr/share/nginx/html node --input-type=module -e 'import {readFileSync,writeFileSync} from "node:fs"; import {renderDeploymentTemplate} from "./scripts/render-deployment.mjs"; writeFileSync("/app/admin.conf",renderDeploymentTemplate(readFileSync("deploy/native/nginx/admin.conf.template","utf8"),process.env));'
RUN mkdir /app/release-public && cp -a /app/releases/${VITE_RELEASE_ID}/public/. /app/release-public/

FROM nginx:1.30.6-trixie
ARG ADMIN_HOST
ARG VITE_APP_BASE_URL=/
ARG VITE_RELEASE_ID
ENV ADMIN_HOST=${ADMIN_HOST} VITE_APP_BASE_URL=${VITE_APP_BASE_URL} VITE_RELEASE_ID=${VITE_RELEASE_ID}
RUN apt-get update && apt-get install -y --no-install-recommends curl openssl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/release-public/ /usr/share/nginx/html/
COPY --from=build /app/admin.conf /etc/nginx/conf.d/default.conf
EXPOSE 80 443
HEALTHCHECK --interval=30s --timeout=5s CMD curl --fail --silent --cacert /etc/kernel-admin/tls/fullchain.pem --resolve ${ADMIN_HOST}:443:127.0.0.1 https://${ADMIN_HOST}${VITE_APP_BASE_URL}_kernel/release | grep -F '"release":"'${VITE_RELEASE_ID}'"' || exit 1

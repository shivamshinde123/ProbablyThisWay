# syntax=docker/dockerfile:1
FROM node:22.23.3-alpine3.24 AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci
COPY apps/web apps/web
COPY packages/contracts packages/contracts
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_CESIUM_ION_ACCESS_TOKEN=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL VITE_CESIUM_ION_ACCESS_TOKEN=$VITE_CESIUM_ION_ACCESS_TOKEN
RUN npm run build -w @probably-this-way/contracts && npm run build -w @probably-this-way/web

FROM nginx:1.30.5-alpine3.24-slim AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

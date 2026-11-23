# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Empty = same origin: the SPA calls /v1/* on the host that serves it (Nginx behind Traefik).
ARG VITE_API_BASE_URL=""
ARG VITE_DEMO_MODE="false"
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_DEMO_MODE=$VITE_DEMO_MODE
RUN npm run build

# ---- Runtime stage ----
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1

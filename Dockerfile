# Multi-stage build: Node builds the Astro static site, nginx serves it.
# Keeps the host clean — no Node/node_modules needed on the host.

FROM node:22-alpine AS builder
WORKDIR /app
# Install deps first (layer-cached unless package files change)
COPY package.json package-lock.json* ./
RUN npm ci || npm install
# Build the static site (needs src/, public/, content, configs)
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

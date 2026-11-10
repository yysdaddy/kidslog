# ---------- 前端构建 ----------
FROM node:22-slim AS web-build
# 国内可用 npmmirror（默认），CI 或海外环境可 --build-arg NPM_REGISTRY=https://registry.npmjs.org
ARG NPM_REGISTRY=https://registry.npmmirror.com
WORKDIR /app/web
COPY web/package.json web/package-lock.json* ./
RUN npm config set registry "$NPM_REGISTRY" \
 && npm install --no-audit --no-fund --fetch-retries=5 --fetch-timeout=120000
COPY web/ ./
RUN npm run build

# ---------- 运行时 ----------
FROM node:22-slim AS runtime
ARG NPM_REGISTRY=https://registry.npmmirror.com
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && apt-get clean \
 && find /var/lib/apt/lists -mindepth 1 -delete
COPY server/package.json server/package-lock.json* ./
RUN npm config set registry "$NPM_REGISTRY" \
 && npm install --omit=dev --no-audit --no-fund --fetch-retries=5 --fetch-timeout=120000
COPY server/ ./
COPY --from=web-build /app/web/dist ./public
RUN mkdir -p /data/media /data/backups
EXPOSE 8080
CMD ["node", "--experimental-sqlite", "src/index.js"]

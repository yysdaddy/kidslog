# ---------- 前端构建 ----------
FROM node:22-slim AS web-build
WORKDIR /app/web
COPY web/package.json web/package-lock.json* ./
RUN npm config set registry https://registry.npmmirror.com \
 && npm install --no-audit --no-fund
COPY web/ ./
RUN npm run build

# ---------- 运行时 ----------
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && apt-get clean \
 && find /var/lib/apt/lists -mindepth 1 -delete
COPY server/package.json server/package-lock.json* ./
RUN npm config set registry https://registry.npmmirror.com \
 && npm install --omit=dev --no-audit --no-fund
COPY server/ ./
COPY --from=web-build /app/web/dist ./public
RUN mkdir -p /data/media /data/backups
EXPOSE 8080
CMD ["node", "--experimental-sqlite", "src/index.js"]

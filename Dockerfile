# ---------------------------------------------------------------------------
# Bhands-blog 生产镜像（多阶段构建）
#   deps    ：安装依赖（postinstall 自动生成 Prisma Client，引擎二进制随容器平台）
#   builder ：next build。SSG 页面（归档/关于/详情等）在构建期会连数据库取数据，
#             通过 build.network=host 直连宿主回环上已启动的 MySQL，
#             见 docker-compose.prod.yml 的 build.args 与 deploy/部署说明.md
#   runner  ：仅带运行时所需文件，非 root 运行
# ---------------------------------------------------------------------------

FROM node:22-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# apt 源带自动回退：优先阿里云 ECS 内网镜像（仅阿里云机器可解析），失败退回官方源
# 国内服务器用阿里云内网镜像源装系统依赖（免流量、快）
RUN sed -i 's|deb.debian.org|mirrors.cloud.aliyuncs.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true; \
    (apt-get update -y || (sed -i 's|mirrors.cloud.aliyuncs.com|deb.debian.org|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true && apt-get update -y)) \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
# postinstall 钩子会执行 prisma generate（schema 已随上面的 COPY 就位）
ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN npm ci --registry=$NPM_REGISTRY --no-audit --no-fund

FROM node:22-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# 2G 内存机器的关键保险：不给 V8 无限堆内存，否则构建期 swap 抖动会把整台机器拖死
ENV NODE_OPTIONS=--max-old-space-size=1280
RUN sed -i 's|deb.debian.org|mirrors.cloud.aliyuncs.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true; \
    (apt-get update -y || (sed -i 's|mirrors.cloud.aliyuncs.com|deb.debian.org|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true && apt-get update -y)) \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 重新显式生成一次，确保与当前 schema 一致
RUN npx prisma generate
# 构建期变量：NEXT_PUBLIC_* 会被内联进客户端产物，改了就要重新构建
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
# lib/posts.ts 在运行时也用 fs 读 content/ 下的 MDX 文章，必须随镜像带上
COPY --from=builder /app/content ./content
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/package.json ./package.json
USER node
EXPOSE 3000
CMD ["npm", "start"]

# Bhands-blog

深空科幻主题（NEXUS STATION）全栈个人博客：Next.js 16 App Router + MySQL + Redis，中英双语。

- 前端：星空 canvas、HUD 仪表盘（真实站点数据）、交互星图、通讯流、系统终端等叙事区块
- 后端：Next.js Route Handlers（`/api/v1`），JWT 认证 + Redis 会话白名单
- 数据库：MySQL（用户 / 评论 / 点赞 / 浏览统计），文章本体保留 MDX 文件
- Redis：会话白名单、评论限流、浏览量计数、热榜 ZSet、评论缓存

## 功能

| 模块 | 说明 |
|---|---|
| 博客 | MDX 文章（Shiki 代码高亮、TOC）、分类/标签筛选、归档、Fuse.js 全文搜索、RSS/sitemap |
| 用户 | 注册 / 登录（JWT 15min access + Redis 白名单 7d refresh 轮换）、封禁、管理台 |
| 互动 | 两级评论（每分钟 5 条限流、第一页缓存）、点赞、浏览量（IP+天去重，惰性回写 MySQL）、热榜 ZSet |
| 管理台 | `/zh/admin`：数据看板、评论隐藏/恢复/销毁、用户封禁/解封（仅 ADMIN 可见可调） |
| 部署 | Vercel Ready；提供独立 docker-compose 备用方案 |

## 本地开发

```bash
# 1. 数据库（默认复用 nexus-mysql:3306 / nexus-redis:6379，也可启用独立实例）
docker compose up -d          # 独立实例：MySQL 3307 / Redis 6380（见 docker-compose.yml）

# 2. 环境变量
cp .env.example .env          # 按需修改连接串；JWT_SECRET 换成随机值

# 3. 建表 + 启动
npm install                   # postinstall 自动 prisma generate
npx prisma db push            # 建表（users/comments/post_likes/post_stats）
npm run dev                   # http://localhost:3000

# 4. 晋升管理员（注册后）
npm run make-admin <用户名>
```

## 写文章

在 `content/zh/`（中文）或 `content/en/`（英文）下新建 `.mdx`，文件名即 URL：

```mdx
---
title: 文章标题
date: 2026-09-30
category: tech        # tech | life | essay
tags: [UE5, C++]
summary: 一句话摘要
---
```

同名文件互为翻译；英文缺失时自动回退中文并标注。改站点资料：`lib/site.ts`；界面文案：`lib/i18n.ts`。

## 环境变量

| 变量 | 作用 |
|---|---|
| `DATABASE_URL` | MySQL 连接串（Prisma） |
| `REDIS_URL` | Redis 连接串（会话/限流/计数/热榜） |
| `JWT_SECRET` | JWT 签名密钥（`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`） |
| `CRON_SECRET` | 可选，Vercel Cron 回写任务的 Bearer 校验 |
| `NEXT_PUBLIC_SITE_URL` | 站点域名，用于 RSS/sitemap/OG |
| `NEXT_PUBLIC_UMAMI_URL` / `NEXT_PUBLIC_UMAMI_SITE_ID` | Umami 统计（可选） |

## 部署

Vercel：导入仓库后配置以上环境变量即可（静态部分无数据库也能跑，动态接口会优雅降级）。
数据库要求：任何可公网访问的 MySQL 8 + Redis（如 TiDB Cloud Serverless + Upstash 免费层）。
详细注意事项见 `.env.example` 注释与 `docker-compose.yml` 头部说明。

## API 一览（`/api/v1`）

```
POST /auth/register | /auth/login | /auth/refresh | /auth/logout     GET /auth/me
GET|POST /posts/{lang}/{slug}/comments          DELETE /comments/{id}
GET|PUT  /posts/{lang}/{slug}/like              POST  /posts/{lang}/{slug}/view
GET      /posts/hot?lang=zh
GET      /admin/stats | /admin/comments | /admin/users
PATCH|DELETE /admin/comments/{id}               PATCH /admin/users/{id}
```

认证采用 **httpOnly Cookie**（`nx_at` access / `nx_rt` refresh），401 时前端自动刷新重试。

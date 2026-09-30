# Bhands-blog

深空主题个人博客（Next.js 16 + Tailwind CSS v4 + MDX），中英双语，部署目标是国内云服务器。

建设计划见 `PLAN.md`。

## 常用命令

```bash
npm run dev      # 本地开发 http://localhost:3000
npm run build    # 生产构建
npm run start    # 生产模式运行
```

## 写文章

在 `content/zh/`（中文）或 `content/en/`（英文）下新建 `.mdx` 文件，文件名即文章 URL：

```mdx
---
title: 文章标题（含冒号时加引号）
date: 2026-09-30
category: tech        # tech | life | essay
tags: [UE5, C++]
summary: 一句话摘要，显示在列表页和 SEO 描述里
---

正文支持 MDX，代码块用 Shiki 构建时高亮。
```

- 同名文件在 `zh/` 和 `en/` 下互为翻译；英文缺失时英文站自动回退中文并标注「中文原文」。
- 改个人资料/社交链接：`lib/site.ts`；改界面文案：`lib/i18n.ts`；改首页栏目与配色：`app/globals.css` 的 `@theme` 段。

## 环境变量（部署时配置）

| 变量 | 作用 |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | 站点域名，用于 RSS/sitemap/OG |
| `NEXT_PUBLIC_TWIKOO_URL` | Twikoo 评论服务地址，不填则不显示评论 |
| `NEXT_PUBLIC_UMAMI_URL` / `NEXT_PUBLIC_UMAMI_SITE_ID` | Umami 统计脚本地址与站点 ID |

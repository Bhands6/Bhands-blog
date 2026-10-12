# 登录后在线写博客

## Context

博客文章目前全部是仓库里的 MDX 文件（`content/zh|en/`），发文章要改文件、重新构建部署。目标：登录账号后可以在站内在线写作、发布、编辑文章，与 MDX 文章在列表/详情/搜索/归档中无缝混合展示。

**默认产品决策**（可调整）：
- **仅 ADMIN 可写**：这是个人博客，写作入口只对管理员（`role === "ADMIN"`）开放；普通注册用户是读者。表结构带 `authorId`，将来开放给所有用户只改权限判断。
- **写作语言可选**：编辑器内选 zh/en，默认当前语言。
- **直接发布**，不做草稿箱（表里有 status 字段留扩展）。
- **编辑/删除**：作者（ADMIN）可编辑、删除自己的在线文章；MDX 文章不可在线编辑。

## 现状要点（探索结论）

- MDX 渲染：[blog/[slug]/page.tsx](../../app/[lang]/blog/[slug]/page.tsx) 用 `@mdx-js/mdx` 的 `evaluate()` + Shiki（tokyo-night）+ remarkGfm + rehypeSlug，仅此一处
- [lib/posts.ts](../../lib/posts.ts) 被 8 处消费（blog 列表 / archives / search / 首页 / feed.xml / sitemap / hot API / 详情页），**在 lib 内部合并数据源**，调用点只加 `await`
- API 模式参考 comments 路由：`getAdminPayload`（lib/auth.ts）+ zod + 401/403/400 错误码；项目用 `npx prisma db push` 建表（无 migrations）
- **冲突点**：`blog/[slug]/page.tsx` 有 `export const dynamicParams = false`（纯 SSG），数据库新文章不在 `allRoutes()` 里会 404 → 移除该约束（保留 generateStaticParams 预渲染 MDX，未知 slug 走服务端动态渲染）
- 列表页/归档/首页是 SSG → 发布/编辑/删除后在 API 里用 `revalidatePath` 按需失效（`/{lang}`、`/{lang}/blog`、`/{lang}/archives`、`/{lang}/search`）
- 渲染安全性：写作仅限 ADMIN（可信作者），DB 文章正文**复用现有 evaluate() 管线**保证与 MDX 完全一致的渲染效果，零新依赖；将来开放普通用户时需加 sanitize

## 实施步骤

### 1. 数据模型（prisma/schema.prisma）

新增 `Post` 模型，User 加反向关联：

```prisma
model Post {
  id        BigInt   @id @default(autoincrement())
  lang      String   @db.Char(2)
  slug      String   @db.VarChar(200)
  title     String   @db.VarChar(200)
  summary   String   @db.VarChar(500)
  category  String   @db.VarChar(20)  // tech | life | essay
  tags      Json?                     // string[]
  content   String   @db.Text         // Markdown 正文（无 frontmatter）
  authorId  BigInt   @map("author_id")
  status    Int      @default(1)      // 1 可见 0 隐藏
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  author    User @relation(fields: [authorId], references: [id])
  @@unique([lang, slug])
  @@map("posts")
}
```

执行 `npx prisma db push`。

### 2. 数据源合并（lib/posts.ts）

- 新增内部异步函数 `dbPosts(lang)`：`prisma.post.findMany({ where: { lang, status: 1 } })`，映射为现有 `Post` 形状（复用 `extractHeadings` / `readingMinutes`，tags JSON → string[]，`createdAt` 作 date）；**过滤与 MDX 同名 slug 的记录**（本地文件优先）
- `getPostsForLang` / `getPost` / `getLatestPost` / `getAdjacent` / `getSearchIndex` 改为 async（`cache()` 兼容异步），合并 MDX + DB 后按日期排序；英文视图同样适用 fallback 逻辑
- `allRoutes()` 保持 MDX-only（generateStaticParams 用）

### 3. 调用点加 await（8 处）

`app/[lang]/blog/page.tsx`、`app/[lang]/archives/page.tsx`、`app/[lang]/search/page.tsx`、`app/[lang]/page.tsx`、`app/feed.xml/route.ts`、`app/sitemap.ts`、`app/api/v1/posts/hot/route.ts`、`app/[lang]/blog/[slug]/page.tsx`。

### 4. 详情页支持动态文章（app/[lang]/blog/[slug]/page.tsx）

- 删除 `export const dynamicParams = false`
- `getPost` 改 await；DB 文章与 MDX 走同一套 evaluate 渲染（提取共用渲染段），TOC/点赞/评论/浏览量自动可用（这些只依赖 lang+slug）

### 5. API（`/api/v1`，模式对齐 comments 路由）

- `POST /api/v1/posts` — 创建（ADMIN）：zod 校验（title 1-200、summary ≤500、category ∈ categoryKeys、tags ≤8 个、content ≤50000）；slug 缺省自动生成（github-slugger 处理 title，中文标题得到空串时回退 `post-<base36时间戳>`）；`(lang,slug)` 冲突返回 409 `SLUG_TAKEN`；成功后 revalidatePath
- `GET /api/v1/posts/[id]` — 读取单篇（ADMIN，供编辑回填）
- `PUT /api/v1/posts/[id]` — 更新（ADMIN）；`DELETE /api/v1/posts/[id]` — 删除（ADMIN），均 revalidatePath
- `POST /api/v1/posts/preview` — Markdown → HTML（ADMIN），供编辑器实时预览（前端 500ms 防抖调用，与正式渲染同一管线）

### 6. 编辑器 UI

- 新页 `app/[lang]/write/page.tsx`（服务端壳）+ `components/post-editor.tsx`（客户端表单）：标题 / 语言选择 / 分类 / 标签（逗号分隔）/ 摘要 / 正文 textarea（mono 字体）/ 「预览」切换（调 preview API）/ 发布按钮；编辑模式通过 `?id=` 回填；成功后跳转文章详情
- 入口：[site-header.tsx](../../components/site-header.tsx) 用户下拉弹窗加「写作」项（仅 `user.role === "ADMIN"` 显示）
- 详情页加编辑入口：小组件 `components/edit-post-link.tsx`（客户端，ADMIN 时在文章标题旁显示「编辑」，链接 `/write?id=`）；仅对 DB 文章显示 → 详情页需知道文章来源（getPost 返回增加 `source: "db" | "mdx"` 标记）
- [i18n.ts](../../lib/i18n.ts)：新增 `nexus.write`（写作 / Write）+ `write` 编辑器文案组（zh/en）

### 7. 权限与降级

- 所有写接口 `getAdminPayload` 失败 → 401/403（对齐现有错误码风格，i18n errors 加 `FORBIDDEN`、`SLUG_TAKEN`）
- MySQL 不可用时：在线文章静默缺失，MDX 文章照常（lib/posts.ts 内 try/catch 包 DB 读取），与现有「动态接口优雅降级」原则一致

## 验证

1. `npx prisma db push` 建表；`npm run dev`
2. 浏览器：登录 ADMIN → 头像下拉出现「写作」→ 打开 `/zh/write` 填写并发布 → 自动跳转详情页，Markdown/代码高亮/TOC/评论/点赞正常
3. 刷新 `/zh/blog` 列表、归档、搜索、首页「最新文章」均能看到新文章；`/feed.xml` 包含该文章
4. 退出登录或用普通账号：无「写作」入口，直接 POST /api/v1/posts 返回 401/403
5. 编辑：详情页「编辑」→ 修改后保存 → 列表与详情即时更新（revalidatePath 生效）
6. 删除文章后详情 404、列表移除
7. `npx tsc --noEmit` 通过

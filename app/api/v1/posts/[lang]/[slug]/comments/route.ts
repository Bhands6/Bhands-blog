import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthPayload } from "@/lib/auth";
import { redis } from "@/lib/redis";

// 评论分页 + 缓存：第一页走 cache-aside（写/删后失效）
const PAGE_SIZE = 20;
const cacheKey = (lang: string, slug: string) => `blog:comments:${lang}:${slug}:p1`;

const postParams = z.object({
  lang: z.string().length(2),
  slug: z.string().min(1).max(200),
});

type CommentRow = {
  id: string;
  content: string;
  createdAt: string;
  isDeleted?: boolean;
  user: { id: string; displayName: string; avatarUrl: string | null; role: string };
  replies: CommentRow[];
};

function serialize(
  c: {
    id: bigint;
    content: string;
    createdAt: Date;
    user: { id: bigint; displayName: string; avatarUrl: string | null; role: string };
  },
  replies: CommentRow[] = [],
): CommentRow {
  return {
    id: c.id.toString(),
    content: c.content,
    createdAt: c.createdAt.toISOString(),
    user: {
      id: c.user.id.toString(),
      displayName: c.user.displayName,
      avatarUrl: c.user.avatarUrl,
      role: c.user.role,
    },
    replies,
  };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ lang: string; slug: string }> },
) {
  const { lang, slug } = await ctx.params;
  if (!postParams.safeParse({ lang, slug }).success) {
    return NextResponse.json({ error: "参数不合法", code: "INVALID_PARAMS" }, { status: 400 });
  }
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);

  // 第一页读缓存
  if (page === 1) {
    const cached = await redis.get(cacheKey(lang, slug));
    if (cached) {
      return NextResponse.json(JSON.parse(cached));
    }
  }

  const where = { postLang: lang, postSlug: slug, parentId: null, status: 1 };
  const [total, topLevel] = await Promise.all([
    prisma.comment.count({ where }),
    prisma.comment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { id: true, displayName: true, avatarUrl: true, role: true } } },
    }),
  ]);
  const ids = topLevel.map((c) => c.id);
  const replies = ids.length
    ? await prisma.comment.findMany({
        where: { parentId: { in: ids }, status: 1 },
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, displayName: true, avatarUrl: true, role: true } } },
      })
    : [];

  const byParent = new Map<bigint, CommentRow[]>();
  for (const r of replies) {
    if (r.parentId === null) continue;
    const list = byParent.get(r.parentId) ?? [];
    list.push(serialize(r));
    byParent.set(r.parentId, list);
  }
  const items = topLevel.map((c) => serialize(c, byParent.get(c.id) ?? []));
  const body = { items, total, page, pageSize: PAGE_SIZE };

  if (page === 1) {
    await redis.set(cacheKey(lang, slug), JSON.stringify(body), "EX", 300);
  }
  return NextResponse.json(body);
}

const createSchema = z.object({
  content: z.string().min(1).max(1000),
  parentId: z.string().regex(/^\d+$/).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ lang: string; slug: string }> },
) {
  const { lang, slug } = await ctx.params;
  const payload = await getAuthPayload(req);
  if (!payload) {
    return NextResponse.json({ error: "登录后才能评论", code: "SESSION_EXPIRED" }, { status: 401 });
  }
  // 封禁复查：JWT 未过期但账户已被封禁
  const me = await prisma.user.findUnique({
    where: { id: BigInt(payload.uid) },
    select: { status: true },
  });
  if (!me || me.status !== 1) {
    return NextResponse.json({ error: "账户不可用", code: "ACCOUNT_DISABLED" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "讯息内容不合法", code: "INVALID_PARAMS" }, { status: 400 });
  }

  // Redis 限流：每分钟最多 5 条
  const rlKey = `blog:rl:comment:${payload.uid}`;
  const hits = await redis.incr(rlKey);
  if (hits === 1) await redis.expire(rlKey, 60);
  if (hits > 5) {
    return NextResponse.json({ error: "发送太频繁", code: "RATE_LIMITED" }, { status: 429 });
  }

  let parentId: bigint | null = null;
  if (parsed.data.parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: BigInt(parsed.data.parentId) },
    });
    if (!parent || parent.postLang !== lang || parent.postSlug !== slug || parent.status !== 1) {
      return NextResponse.json({ error: "回复目标不存在", code: "INVALID_PARAMS" }, { status: 400 });
    }
    // 楼中楼拍平到顶层，保持两级结构
    parentId = parent.parentId ?? parent.id;
  }

  const comment = await prisma.comment.create({
    data: {
      postLang: lang,
      postSlug: slug,
      userId: BigInt(payload.uid),
      parentId,
      content: parsed.data.content,
    },
    include: { user: { select: { id: true, displayName: true, avatarUrl: true, role: true } } },
  });

  await redis.del(cacheKey(lang, slug));
  return NextResponse.json(
    {
      comment: serialize(comment),
    },
    { status: 201 },
  );
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPayload } from "@/lib/auth";
import { redis } from "@/lib/redis";
import { getViews } from "@/lib/stats";

const likeCountKey = (lang: string, slug: string) => `blog:likes:count:${lang}:${slug}`;

async function likeCount(lang: string, slug: string) {
  const cached = await redis.get(likeCountKey(lang, slug));
  if (cached) return Number(cached);
  const count = await prisma.postLike.count({
    where: { postLang: lang, postSlug: slug },
  });
  await redis.set(likeCountKey(lang, slug), String(count), "EX", 300);
  return count;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ lang: string; slug: string }> },
) {
  const { lang, slug } = await ctx.params;
  const payload = await getAuthPayload(req);
  let liked = false;
  if (payload) {
    const row = await prisma.postLike.findUnique({
      where: {
        postLang_postSlug_userId: {
          postLang: lang,
          postSlug: slug,
          userId: BigInt(payload.uid),
        },
      },
    });
    liked = !!row;
  }
  const [count, views] = await Promise.all([likeCount(lang, slug), getViews(lang, slug)]);
  return NextResponse.json({ liked, count, views });
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ lang: string; slug: string }> },
) {
  const { lang, slug } = await ctx.params;
  const payload = await getAuthPayload(req);
  if (!payload) {
    return NextResponse.json({ error: "登录后才能点赞", code: "SESSION_EXPIRED" }, { status: 401 });
  }
  // 封禁复查：JWT 未过期但账户已被封禁
  const me = await prisma.user.findUnique({
    where: { id: BigInt(payload.uid) },
    select: { status: true },
  });
  if (!me || me.status !== 1) {
    return NextResponse.json({ error: "账户不可用", code: "ACCOUNT_DISABLED" }, { status: 403 });
  }
  const userId = BigInt(payload.uid);
  const key = { postLang: lang, postSlug: slug, userId };

  const existing = await prisma.postLike.findUnique({ where: { postLang_postSlug_userId: key } });
  if (existing) {
    await prisma.postLike.delete({ where: { postLang_postSlug_userId: key } });
  } else {
    await prisma.postLike.create({ data: key });
  }
  const count = await prisma.postLike.count({ where: { postLang: lang, postSlug: slug } });

  // 写库成功后刷新缓存与统计行（cache-aside）
  await redis.set(likeCountKey(lang, slug), String(count), "EX", 300);
  await prisma.postStat.upsert({
    where: { postLang_postSlug: { postLang: lang, postSlug: slug } },
    create: { postLang: lang, postSlug: slug, likes: count },
    update: { likes: count },
  });

  const views = await getViews(lang, slug);
  return NextResponse.json({ liked: !existing, count, views });
}

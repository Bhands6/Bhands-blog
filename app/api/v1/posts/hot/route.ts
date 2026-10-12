import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { getPost } from "@/lib/posts";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lang = url.searchParams.get("lang") ?? "zh";
  if (!/^(zh|en)$/.test(lang)) {
    return NextResponse.json({ error: "参数不合法", code: "INVALID_PARAMS" }, { status: 400 });
  }

  // ZSet blog:hot:{lang}：member = slug，score = 浏览量，取 Top 10
  const rows = await redis.zrevrange(`blog:hot:${lang}`, 0, 9, "WITHSCORES");
  const ranked: {
    slug: string;
    title: string;
    summary: string;
    views: number;
    sortKey: string;
  }[] = [];
  for (let i = 0; i < rows.length; i += 2) {
    const slug = rows[i];
    const post = await getPost(lang as "zh" | "en", slug);
    if (!post) continue;
    ranked.push({
      slug,
      title: post.title,
      summary: post.summary,
      views: Math.round(Number(rows[i + 1])),
      sortKey: post.sortKey,
    });
  }
  // Redis ZSet 在 score 相同时按 member 的逆字典序返回，与博客列表页的热榜口径相反。
  // 统一成「浏览量 desc，发布时间 desc」，两处显示才不会打架。
  ranked.sort((a, b) => b.views - a.views || b.sortKey.localeCompare(a.sortKey));

  const items = ranked.map(({ slug, title, summary, views }) => ({
    slug,
    title,
    summary,
    views,
  }));
  return NextResponse.json({ items });
}

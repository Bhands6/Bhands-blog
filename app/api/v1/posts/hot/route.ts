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
  const items: { slug: string; title: string; summary: string; views: number }[] = [];
  for (let i = 0; i < rows.length; i += 2) {
    const slug = rows[i];
    const post = getPost(lang as "zh" | "en", slug);
    if (!post) continue;
    items.push({
      slug,
      title: post.title,
      summary: post.summary,
      views: Math.round(Number(rows[i + 1])),
    });
  }
  return NextResponse.json({ items });
}

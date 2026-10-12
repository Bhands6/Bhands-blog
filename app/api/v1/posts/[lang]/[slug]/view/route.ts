import { NextResponse } from "next/server";
import { getViews, hashIp, recordView } from "@/lib/stats";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ lang: string; slug: string }> },
) {
  const { lang, slug } = await ctx.params;
  if (!/^(zh|en)$/.test(lang) || !slug || slug.length > 200) {
    return NextResponse.json({ error: "参数不合法", code: "INVALID_PARAMS" }, { status: 400 });
  }
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const fresh = await recordView(lang, slug, hashIp(ip));
  // 回传打点后的最新浏览量：前端「拉取统计」与「浏览打点」是并发发出的，
  // 只返回 counted 的话，页面会一直显示打点之前的旧值（首次访问少 1）
  const views = await getViews(lang, slug);
  return NextResponse.json({ counted: fresh, views });
}

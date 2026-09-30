import { NextResponse } from "next/server";
import { hashIp, recordView } from "@/lib/stats";

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
  return NextResponse.json({ counted: fresh });
}

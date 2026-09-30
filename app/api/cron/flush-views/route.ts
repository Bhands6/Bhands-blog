import { NextResponse } from "next/server";
import { flushViews } from "@/lib/stats";

// 浏览量定时兜底回写（Vercel Cron：每天 03:00 UTC；低流量场景下
// 惰性回写可能长时间不触发，这里兜底把 Redis 累计值刷进 MySQL）
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  try {
    await flushViews();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("cron flush failed:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

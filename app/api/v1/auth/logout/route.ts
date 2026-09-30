import { NextResponse } from "next/server";
import { clearRefreshToken, verifyAccessToken } from "@/lib/auth";

export async function POST(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "缺少凭证", code: "SESSION_EXPIRED" }, { status: 401 });
  }
  const payload = await verifyAccessToken(token);
  if (!payload) {
    return NextResponse.json({ error: "凭证无效", code: "SESSION_EXPIRED" }, { status: 401 });
  }
  // 撤销 Redis 白名单中的 refresh token，全端下线
  await clearRefreshToken(payload.uid);
  return NextResponse.json({ ok: true });
}

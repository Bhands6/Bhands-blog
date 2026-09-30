import { NextResponse } from "next/server";
import { clearRefreshToken, clearSessionCookies, getAuthPayload, getSessionRefreshToken } from "@/lib/auth";

export async function POST(req: Request) {
  // 优先从 access token 取 uid；过期则从 refresh token 前缀解析
  let uid: string | null = (await getAuthPayload(req))?.uid ?? null;
  if (!uid) {
    const rt = getSessionRefreshToken(req);
    const dot = rt?.indexOf(".") ?? -1;
    uid = rt && dot > 0 ? rt.slice(0, dot) : null;
  }
  if (uid) await clearRefreshToken(uid);

  const res = NextResponse.json({ ok: true });
  clearSessionCookies(res);
  return res;
}

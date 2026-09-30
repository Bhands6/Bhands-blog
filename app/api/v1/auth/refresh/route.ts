import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  applySessionCookies,
  generateRefreshToken,
  getRefreshToken,
  getSessionRefreshToken,
  signAccessToken,
  storeRefreshToken,
} from "@/lib/auth";

export async function POST(req: Request) {
  const refreshToken = getSessionRefreshToken(req);
  if (!refreshToken) {
    return NextResponse.json({ error: "登录态已失效，请重新登录", code: "SESSION_EXPIRED" }, { status: 401 });
  }

  // token 形如 "{uid}.{secret}"，可直接定位 Redis 白名单条目
  const dot = refreshToken.indexOf(".");
  if (dot <= 0) {
    return NextResponse.json({ error: "登录态已失效，请重新登录", code: "SESSION_EXPIRED" }, { status: 401 });
  }
  const uid = refreshToken.slice(0, dot);
  const stored = await getRefreshToken(uid);
  if (!stored || stored !== refreshToken) {
    return NextResponse.json({ error: "登录态已失效，请重新登录", code: "SESSION_EXPIRED" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: BigInt(uid) } });
  if (!user || user.status !== 1) {
    return NextResponse.json({ error: "账户不可用", code: "ACCOUNT_DISABLED" }, { status: 401 });
  }

  // 轮换：旧 refresh 立即作废
  const rotated = `${uid}.${generateRefreshToken()}`;
  await storeRefreshToken(uid, rotated);
  const accessToken = await signAccessToken({
    uid,
    username: user.username,
    role: user.role,
  });

  const res = NextResponse.json({
    user: {
      id: user.id.toString(),
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      avatarUrl: user.avatarUrl,
    },
  });
  applySessionCookies(res, { accessToken, refreshToken: rotated });
  return res;
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateRefreshToken, getRefreshToken, signAccessToken, storeRefreshToken } from "@/lib/auth";

const schema = z.object({ refreshToken: z.string().min(16) });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "缺少 refreshToken", code: "SESSION_EXPIRED" }, { status: 400 });
  }

  // refreshToken 形如 "{uid}.{secret}"，可直接定位白名单条目
  const dot = parsed.data.refreshToken.indexOf(".");
  if (dot <= 0) {
    return NextResponse.json({ error: "登录态已失效", code: "SESSION_EXPIRED" }, { status: 401 });
  }
  const uid = parsed.data.refreshToken.slice(0, dot);
  const stored = await getRefreshToken(uid);
  if (!stored || stored !== parsed.data.refreshToken) {
    return NextResponse.json({ error: "登录态已失效，请重新登录", code: "SESSION_EXPIRED" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: BigInt(uid) } });
  if (!user || user.status !== 1) {
    return NextResponse.json({ error: "账户不可用", code: "ACCOUNT_DISABLED" }, { status: 401 });
  }

  // 轮换：旧 refresh 立即作废
  const refreshToken = `${uid}.${generateRefreshToken()}`;
  await storeRefreshToken(uid, refreshToken);
  const accessToken = await signAccessToken({
    uid,
    username: user.username,
    role: user.role,
  });
  return NextResponse.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id.toString(),
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      avatarUrl: user.avatarUrl,
    },
  });
}

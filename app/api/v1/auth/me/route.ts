import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicUser, verifyAccessToken } from "@/lib/auth";

export async function GET(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "缺少凭证", code: "SESSION_EXPIRED" }, { status: 401 });
  }
  const payload = await verifyAccessToken(token);
  if (!payload) {
    return NextResponse.json({ error: "凭证无效或已过期", code: "SESSION_EXPIRED" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({ where: { id: BigInt(payload.uid) } });
  if (!user || user.status !== 1) {
    return NextResponse.json({ error: "账户不可用", code: "ACCOUNT_DISABLED" }, { status: 401 });
  }
  return NextResponse.json({ user: publicUser(user) });
}

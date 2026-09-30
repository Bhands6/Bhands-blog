import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPayload, publicUser } from "@/lib/auth";

export async function GET(req: Request) {
  const payload = await getAuthPayload(req);
  if (!payload) {
    return NextResponse.json({ error: "凭证无效或已过期", code: "SESSION_EXPIRED" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({ where: { id: BigInt(payload.uid) } });
  if (!user || user.status !== 1) {
    return NextResponse.json({ error: "账户不可用", code: "ACCOUNT_DISABLED" }, { status: 401 });
  }
  return NextResponse.json({ user: publicUser(user) });
}

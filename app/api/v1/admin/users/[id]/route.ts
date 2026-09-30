import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminPayload } from "@/lib/auth";
import { clearRefreshToken } from "@/lib/auth";

const patchSchema = z.object({ status: z.union([z.literal(0), z.literal(1)]) });

// PATCH：封禁 / 解封用户
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminPayload(req);
  if (!admin) {
    return NextResponse.json({ error: "需要 ADMIN 权限", code: "FORBIDDEN" }, { status: 403 });
  }
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "参数不合法", code: "INVALID_PARAMS" }, { status: 400 });
  }
  if (id === admin.uid) {
    return NextResponse.json({ error: "不能封禁自己", code: "SELF_BAN" }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "status 必须为 0 或 1", code: "INVALID_PARAMS" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: BigInt(id) } });
  if (!user) {
    return NextResponse.json({ error: "用户不存在", code: "INVALID_PARAMS" }, { status: 404 });
  }
  await prisma.user.update({ where: { id: user.id }, data: { status: parsed.data.status } });

  // 封禁即踢下线：撤销 Redis refresh 白名单
  if (parsed.data.status === 0) {
    await clearRefreshToken(user.id.toString());
  }
  return NextResponse.json({ ok: true, status: parsed.data.status });
}

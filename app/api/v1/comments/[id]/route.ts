import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthPayload } from "@/lib/auth";
import { redis } from "@/lib/redis";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "参数不合法", code: "INVALID_PARAMS" }, { status: 400 });
  }
  const payload = await getAuthPayload(req);
  if (!payload) {
    return NextResponse.json({ error: "登录后才能操作", code: "SESSION_EXPIRED" }, { status: 401 });
  }

  const comment = await prisma.comment.findUnique({ where: { id: BigInt(id) } });
  if (!comment || comment.status !== 1) {
    return NextResponse.json({ error: "讯息不存在", code: "INVALID_PARAMS" }, { status: 404 });
  }
  const isOwner = comment.userId.toString() === payload.uid;
  const isAdmin = payload.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "没有权限", code: "INVALID_PARAMS" }, { status: 403 });
  }

  await prisma.comment.update({ where: { id: comment.id }, data: { status: 0 } });
  await redis.del(`blog:comments:${comment.postLang}:${comment.postSlug}:p1`);
  return NextResponse.json({ ok: true });
}

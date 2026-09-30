import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminPayload } from "@/lib/auth";
import { redis } from "@/lib/redis";

const patchSchema = z.object({ status: z.union([z.literal(0), z.literal(1)]) });

// PATCH：隐藏 / 恢复评论
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
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "status 必须为 0 或 1", code: "INVALID_PARAMS" }, { status: 400 });
  }

  const comment = await prisma.comment.findUnique({ where: { id: BigInt(id) } });
  if (!comment) {
    return NextResponse.json({ error: "讯息不存在", code: "INVALID_PARAMS" }, { status: 404 });
  }
  await prisma.comment.update({
    where: { id: comment.id },
    data: { status: parsed.data.status },
  });
  await redis.del(`blog:comments:${comment.postLang}:${comment.postSlug}:p1`);
  return NextResponse.json({ ok: true, status: parsed.data.status });
}

// DELETE：硬删评论及其回复
export async function DELETE(
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
  const comment = await prisma.comment.findUnique({ where: { id: BigInt(id) } });
  if (!comment) {
    return NextResponse.json({ error: "讯息不存在", code: "INVALID_PARAMS" }, { status: 404 });
  }

  const replies = await prisma.comment.deleteMany({ where: { parentId: comment.id } });
  await prisma.comment.delete({ where: { id: comment.id } });
  await redis.del(`blog:comments:${comment.postLang}:${comment.postSlug}:p1`);
  return NextResponse.json({ ok: true, removed: replies.count + 1 });
}

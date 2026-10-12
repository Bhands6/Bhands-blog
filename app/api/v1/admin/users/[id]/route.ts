import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { requireAdmin, clearRefreshToken } from "@/lib/auth";

const patchSchema = z.object({ status: z.union([z.literal(0), z.literal(1)]) });

// PATCH：封禁 / 解封用户
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(req);
  if ("error" in admin) return admin.error;
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "参数不合法", code: "INVALID_PARAMS" }, { status: 400 });
  }
  if (id === admin.payload.uid) {
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

// DELETE：永久删除账号，连带其评论、回复、点赞与上传的图片
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(req);
  if ("error" in admin) return admin.error;
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "参数不合法", code: "INVALID_PARAMS" }, { status: 400 });
  }
  if (id === admin.payload.uid) {
    return NextResponse.json({ error: "不能删除自己", code: "SELF_DELETE" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ error: "用户不存在", code: "INVALID_PARAMS" }, { status: 404 });
  }

  // 用户写的文章不做级联删除：内容资产误删代价太大，先让管理员自己处理
  const postCount = await prisma.post.count({ where: { authorId: user.id } });
  if (postCount > 0) {
    return NextResponse.json(
      { error: `该账号还有 ${postCount} 篇文章，请先删除或转移后再删账号`, code: "HAS_POSTS" },
      { status: 409 },
    );
  }

  // 该用户评论过的文章，删完要清掉评论列表缓存
  const affected = await prisma.comment.findMany({
    where: { userId: user.id },
    select: { postLang: true, postSlug: true },
    distinct: ["postLang", "postSlug"],
  });

  await prisma.$transaction(async (tx) => {
    // Comment.parentId 是自引用外键：必须先删掉「以该用户评论为父」的记录，
    // 否则直接批量删父评论会撞约束。这一步同时会带走别人对 TA 的回复。
    const mine = await tx.comment.findMany({ where: { userId: user.id }, select: { id: true } });
    const ids = mine.map((c) => c.id);
    if (ids.length > 0) {
      await tx.comment.deleteMany({ where: { parentId: { in: ids } } });
      await tx.comment.deleteMany({ where: { userId: user.id } });
    }
    await tx.postLike.deleteMany({ where: { userId: user.id } });
    await tx.media.deleteMany({ where: { uploaderId: user.id } });
    await tx.user.delete({ where: { id: user.id } });
  });

  await clearRefreshToken(user.id.toString()); // 撤销会话白名单，账号立刻下线
  await Promise.all(
    affected.map((a) => redis.del(`blog:comments:${a.postLang}:${a.postSlug}:p1`)),
  );

  return NextResponse.json({ ok: true });
}

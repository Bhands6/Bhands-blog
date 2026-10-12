import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if ("error" in admin) return admin.error;
  const [users, comments, likes, viewsAgg] = await Promise.all([
    prisma.user.count(),
    prisma.comment.count({ where: { status: 1 } }),
    prisma.postLike.count(),
    prisma.postStat.aggregate({ _sum: { views: true } }),
  ]);
  return NextResponse.json({
    users,
    comments,
    likes,
    // postStat.views 是 BigInt 列，聚合结果同为 BigInt —— JSON.stringify 无法序列化，
    // 必须显式转 Number，否则整个接口 500（"Do not know how to serialize a BigInt"）
    views: Number(viewsAgg._sum.views ?? 0),
  });
}

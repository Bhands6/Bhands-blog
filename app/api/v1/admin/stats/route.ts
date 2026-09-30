import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminPayload } from "@/lib/auth";

export async function GET(req: Request) {
  const admin = await getAdminPayload(req);
  if (!admin) {
    return NextResponse.json({ error: "需要 ADMIN 权限", code: "FORBIDDEN" }, { status: 403 });
  }
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
    views: viewsAgg._sum.views ?? 0,
  });
}

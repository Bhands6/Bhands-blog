import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { countAllPosts } from "@/lib/posts";

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if ("error" in admin) return admin.error;
  const [users, comments, likes, viewsAgg, posts] = await Promise.all([
    prisma.user.count(),
    prisma.comment.count({ where: { status: 1 } }),
    prisma.postLike.count(),
    prisma.postStat.aggregate({ _sum: { views: true } }),
    countAllPosts(),
  ]);
  return NextResponse.json({
    users,
    // 文章总数：MDX 文件 + 在线写作，按 slug 去重（英文视图会回退中文，不能简单相加）
    posts,
    comments,
    likes,
    // postStat.views 是 BigInt 列，聚合结果同为 BigInt —— JSON.stringify 无法序列化，
    // 必须显式转 Number，否则整个接口 500（"Do not know how to serialize a BigInt"）
    views: Number(viewsAgg._sum.views ?? 0),
  });
}

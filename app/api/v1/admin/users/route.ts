import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const PAGE_SIZE = 20;

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if ("error" in admin) return admin.error;
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);

  const [total, users] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({
      // 管理员置顶：Role 枚举为 ADMIN | READER，字母序 ADMIN 恰好在前；
      // 同级之间仍按注册时间倒序
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        createdAt: true,
        _count: { select: { comments: true } },
      },
    }),
  ]);

  return NextResponse.json({
    items: users.map((u) => ({
      id: u.id.toString(),
      username: u.username,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt.toISOString(),
      commentCount: u._count.comments,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
  });
}

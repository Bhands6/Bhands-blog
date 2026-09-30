import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminPayload } from "@/lib/auth";

const PAGE_SIZE = 20;

export async function GET(req: Request) {
  const admin = await getAdminPayload(req);
  if (!admin) {
    return NextResponse.json({ error: "需要 ADMIN 权限", code: "FORBIDDEN" }, { status: 403 });
  }
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);

  const [total, users] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
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

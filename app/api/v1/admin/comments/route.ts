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
  const status = url.searchParams.get("status");

  const where = {
    ...(status === "hidden" ? { status: 0 } : status === "visible" ? { status: 1 } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.comment.count({ where }),
    prisma.comment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { displayName: true, role: true } } },
    }),
  ]);

  return NextResponse.json({
    items: rows.map((c) => ({
      id: c.id.toString(),
      postLang: c.postLang,
      postSlug: c.postSlug,
      content: c.content,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      author: c.user.displayName,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
  });
}

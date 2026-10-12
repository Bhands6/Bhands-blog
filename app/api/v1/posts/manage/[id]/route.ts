import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthPayload } from "@/lib/auth";
import { deletePostCascade, pruneAfterPostUpdate } from "@/lib/media";

// 在线写作：读取 / 更新 / 删除单篇文章（仅 ADMIN）
async function requireAdmin(req: Request) {
  const payload = await getAuthPayload(req);
  if (!payload) {
    return {
      error: NextResponse.json({ error: "登录后才能操作", code: "SESSION_EXPIRED" }, { status: 401 }),
    } as const;
  }
  if (payload.role !== "ADMIN") {
    return {
      error: NextResponse.json({ error: "没有操作权限", code: "FORBIDDEN" }, { status: 403 }),
    } as const;
  }
  return { payload } as const;
}

// slug 允许中文等 Unicode 字符（URL 百分号编码后可正常路由）
const slugSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[^\s/?#]+$/);

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: slugSchema.optional(),
  lang: z.enum(["zh", "en"]).optional(),
  summary: z.string().max(500).optional(),
  category: z.enum(["tech", "life", "essay"]).optional(),
  tags: z.array(z.string().min(1).max(30)).max(8).optional(),
  content: z.string().min(1).max(50000).optional(),
});

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if ("error" in admin) return admin.error;

  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "参数不合法", code: "INVALID_PARAMS" }, { status: 400 });
  }
  const post = await prisma.post.findUnique({ where: { id: BigInt(id) } });
  if (!post) {
    return NextResponse.json({ error: "文章不存在", code: "INVALID_PARAMS" }, { status: 404 });
  }
  return NextResponse.json({
    post: {
      id: post.id.toString(),
      lang: post.lang,
      slug: post.slug,
      title: post.title,
      summary: post.summary,
      category: post.category,
      tags: Array.isArray(post.tags) ? (post.tags as string[]) : [],
      content: post.content,
    },
  });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if ("error" in admin) return admin.error;

  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "参数不合法", code: "INVALID_PARAMS" }, { status: 400 });
  }
  const existing = await prisma.post.findUnique({ where: { id: BigInt(id) } });
  if (!existing) {
    return NextResponse.json({ error: "文章不存在", code: "INVALID_PARAMS" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "文章内容不合法", code: "INVALID_PARAMS" }, { status: 400 });
  }
  const d = parsed.data;

  try {
    await prisma.post.update({
      where: { id: BigInt(id) },
      data: {
        ...(d.title !== undefined && { title: d.title }),
        ...(d.slug !== undefined && { slug: d.slug }),
        ...(d.lang !== undefined && { lang: d.lang }),
        ...(d.summary !== undefined && { summary: d.summary }),
        ...(d.category !== undefined && { category: d.category }),
        ...(d.tags !== undefined && { tags: d.tags }),
        ...(d.content !== undefined && { content: d.content }),
      },
    });
    // 旧路径（slug/lang 可能被修改）与新路径都要失效
    revalidatePath(`/${existing.lang}`);
    revalidatePath(`/${existing.lang}/blog`);
    revalidatePath(`/${existing.lang}/archives`);
    revalidatePath(`/${existing.lang}/search`);
    revalidatePath(`/${existing.lang}/blog/${existing.slug}`);
    if (d.lang && d.lang !== existing.lang) {
      revalidatePath(`/${d.lang}`);
      revalidatePath(`/${d.lang}/blog`);
    }
    // 回收「本次编辑删掉、且没有别处引用」的图片（updateSchema 是部分更新，缺省沿用旧值）
    const removedMedia = await pruneAfterPostUpdate(
      { content: existing.content, summary: existing.summary },
      { content: d.content ?? existing.content, summary: d.summary ?? existing.summary },
    );
    return NextResponse.json({ ok: true, removedMedia });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "该 slug 已被占用", code: "SLUG_TAKEN" }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if ("error" in admin) return admin.error;

  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "参数不合法", code: "INVALID_PARAMS" }, { status: 400 });
  }
  const existing = await prisma.post.findUnique({ where: { id: BigInt(id) } });
  if (!existing) {
    return NextResponse.json({ error: "文章不存在", code: "INVALID_PARAMS" }, { status: 404 });
  }

  // 级联回收：只删「这篇文章引用、且没有任何其它文章 / MDX 引用」的图片
  const { removedMedia } = await deletePostCascade(BigInt(id));
  revalidatePath(`/${existing.lang}`);
  revalidatePath(`/${existing.lang}/blog`);
  revalidatePath(`/${existing.lang}/archives`);
  revalidatePath(`/${existing.lang}/search`);
  return NextResponse.json({ ok: true, removedMedia });
}

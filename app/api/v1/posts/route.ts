import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import GithubSlugger from "github-slugger";
import { prisma } from "@/lib/prisma";
import { getAuthPayload } from "@/lib/auth";

// 在线写作：创建文章（仅 ADMIN）
// slug 允许中文等 Unicode 字符（URL 百分号编码后可正常路由）
const slugSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[^\s/?#]+$/);

const createSchema = z.object({
  title: z.string().min(1).max(200),
  slug: slugSchema.optional(),
  lang: z.enum(["zh", "en"]),
  summary: z.string().max(500),
  category: z.enum(["tech", "life", "essay"]),
  tags: z.array(z.string().min(1).max(30)).max(8).optional(),
  content: z.string().min(1).max(50000),
});

/** slug 缺省时从标题生成；纯中文标题得到空串则回退 post-<base36 时间戳> */
function slugify(title: string): string {
  const s = new GithubSlugger().slug(title).replace(/^-+|-+$/g, "");
  return s || `post-${Date.now().toString(36)}`;
}

export async function POST(req: Request) {
  const payload = await getAuthPayload(req);
  if (!payload) {
    return NextResponse.json({ error: "登录后才能写作", code: "SESSION_EXPIRED" }, { status: 401 });
  }
  if (payload.role !== "ADMIN") {
    return NextResponse.json({ error: "没有写作权限", code: "FORBIDDEN" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "文章内容不合法", code: "INVALID_PARAMS" }, { status: 400 });
  }
  const { title, lang, summary, category, content } = parsed.data;
  const slug = parsed.data.slug ?? slugify(title);
  const tags = parsed.data.tags ?? [];

  try {
    const post = await prisma.post.create({
      data: {
        lang,
        slug,
        title,
        summary,
        category,
        tags,
        content,
        authorId: BigInt(payload.uid),
      },
    });
    revalidatePath(`/${lang}`);
    revalidatePath(`/${lang}/blog`);
    revalidatePath(`/${lang}/archives`);
    revalidatePath(`/${lang}/search`);
    return NextResponse.json(
      { post: { id: post.id.toString(), lang, slug } },
      { status: 201 },
    );
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "该 slug 已被占用", code: "SLUG_TAKEN" },
        { status: 409 },
      );
    }
    throw err;
  }
}

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isLang } from "@/lib/posts";
import { normalizeAboutContent, saveAboutContent } from "@/lib/site-content";

const bodySchema = z.object({
  lang: z.string(),
  paragraphs: z.array(z.string().max(500)).max(20),
  facts: z
    .array(
      z.object({
        k: z.string().max(40),
        v: z.string().max(300),
      }),
    )
    .max(20),
});

/** PUT：保存关于页内容（仅 ADMIN）。整份覆盖，不做字段级合并。 */
export async function PUT(req: Request) {
  const guard = await requireAdmin(req);
  if ("error" in guard) return guard.error;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "内容不合法：请检查段落与信息行的长度", code: "INVALID_PARAMS" },
      { status: 400 },
    );
  }

  const { lang } = parsed.data;
  if (!isLang(lang)) {
    return NextResponse.json({ error: "语言参数不合法", code: "INVALID_PARAMS" }, { status: 400 });
  }

  const content = normalizeAboutContent({
    paragraphs: parsed.data.paragraphs,
    facts: parsed.data.facts,
  });
  if (content.paragraphs.length === 0) {
    return NextResponse.json({ error: "至少保留一段正文", code: "INVALID_PARAMS" }, { status: 400 });
  }

  try {
    await saveAboutContent(lang, content);
  } catch (err) {
    console.error("save about content failed:", err);
    return NextResponse.json({ error: "保存失败，请稍后再试", code: "SERVER_ERROR" }, { status: 500 });
  }

  revalidatePath(`/${lang}/about`);
  return NextResponse.json({ ok: true, content });
}

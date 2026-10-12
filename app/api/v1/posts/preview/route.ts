import { createElement } from "react";
import { NextResponse } from "next/server";
import { evaluate } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeShiki from "@shikijs/rehype";
import { getAuthPayload } from "@/lib/auth";

// 在线写作：Markdown → HTML 预览（与详情页同一渲染管线，仅 ADMIN）
export async function POST(req: Request) {
  const payload = await getAuthPayload(req);
  if (!payload) {
    return NextResponse.json({ error: "登录后才能操作", code: "SESSION_EXPIRED" }, { status: 401 });
  }
  if (payload.role !== "ADMIN") {
    return NextResponse.json({ error: "没有操作权限", code: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { content?: string } | null;
  const content = body?.content;
  if (typeof content !== "string" || content.length > 50000) {
    return NextResponse.json({ error: "参数不合法", code: "INVALID_PARAMS" }, { status: 400 });
  }

  // react-dom/server 不能在路由处理器顶层导入（Turbopack 限制），动态导入
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { default: MDXContent } = await evaluate(content, {
    ...(runtime as unknown as Record<string, unknown>),
    remarkPlugins: [remarkGfm],
    rehypePlugins: [
      rehypeSlug,
      [rehypeShiki, { theme: "tokyo-night", fallbackLanguage: "plain" }],
    ],
  } as unknown as Parameters<typeof evaluate>[1]);

  return NextResponse.json({ html: renderToStaticMarkup(createElement(MDXContent)) });
}

import { cache } from "react";
import { getDict } from "./i18n";
import { prisma } from "./prisma";
import type { Lang } from "./posts";

/** 关于页右侧的一行「标签 / 内容」 */
export interface AboutFact {
  k: string;
  v: string;
}

/** 关于页可被管理员编辑的内容 */
export interface AboutContent {
  paragraphs: string[];
  facts: AboutFact[];
}

const ABOUT_KEY = "about";

/**
 * i18n 里的出厂值。
 * `site_content` 表里还没有这个 key（或数据库不可用）时用它 ——
 * 所以这张表为空时页面表现与改造前完全一致，不打乱渲染。
 */
export function defaultAboutContent(lang: Lang): AboutContent {
  const t = getDict(lang);
  return {
    paragraphs: t.about.paragraphs.map((p) => String(p)),
    facts: [
      ...t.landing.facts.map((f) => ({ k: String(f.k), v: String(f.v) })),
      { k: String(t.about.stackLabel), v: String(t.about.stack) },
    ],
  };
}

/** 把任意形状的 JSON 收窄成 AboutContent；结构不对就返回 null（调用方回落默认值） */
function coerce(input: unknown): AboutContent | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as { paragraphs?: unknown; facts?: unknown };
  if (!Array.isArray(raw.paragraphs) || !Array.isArray(raw.facts)) return null;
  return {
    paragraphs: raw.paragraphs.map((p) => String(p)),
    facts: raw.facts.map((f) => {
      const o = (f ?? {}) as { k?: unknown; v?: unknown };
      return { k: String(o.k ?? ""), v: String(o.v ?? "") };
    }),
  };
}

/**
 * 读取关于页内容：数据库优先，无记录 / 结构异常 / 数据库不可用都回落 i18n 默认值。
 * 用 cache() 去重 —— generateMetadata 与页面组件会各调一次，同一请求内只查一次库。
 */
export const getAboutContent = cache(async (lang: Lang): Promise<AboutContent> => {
  try {
    const row = await prisma.siteContent.findUnique({
      where: { key_lang: { key: ABOUT_KEY, lang } },
      select: { value: true },
    });
    const parsed = row ? coerce(JSON.parse(row.value)) : null;
    if (parsed) return parsed;
  } catch (err) {
    // 数据库不可用不影响静态部分渲染
    console.error("read site_content failed:", err);
  }
  return defaultAboutContent(lang);
});

/** 写入（upsert）：整份 JSON 覆盖，不做字段级合并 */
export async function saveAboutContent(lang: Lang, content: AboutContent): Promise<void> {
  const value = JSON.stringify(content);
  await prisma.siteContent.upsert({
    where: { key_lang: { key: ABOUT_KEY, lang } },
    create: { key: ABOUT_KEY, lang, value },
    update: { value },
  });
}

/** 清空段落与信息行：去首尾空白、丢掉纯空行（避免存一堆看不见的空串）*/
export function normalizeAboutContent(content: AboutContent): AboutContent {
  return {
    paragraphs: content.paragraphs.map((p) => p.trim()).filter(Boolean),
    facts: content.facts
      .map((f) => ({ k: f.k.trim(), v: f.v.trim() }))
      .filter((f) => f.k !== "" || f.v !== ""),
  };
}

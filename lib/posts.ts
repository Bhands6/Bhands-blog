import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import matter from "gray-matter";
import GithubSlugger from "github-slugger";

export type Lang = "zh" | "en";
export const langs: Lang[] = ["zh", "en"];

export function isLang(v: string): v is Lang {
  return (langs as string[]).includes(v);
}

export type CategoryKey = "tech" | "life" | "essay";
export const categoryKeys: CategoryKey[] = ["tech", "life", "essay"];

export interface Heading {
  depth: 2 | 3;
  text: string;
  slug: string;
}

export interface PostMeta {
  slug: string;
  lang: Lang;
  title: string;
  date: string; // YYYY-MM-DD
  category: CategoryKey;
  tags: string[];
  summary: string;
  readingMinutes: number;
  /** 在该语言下可见、但实际只有中文原文 */
  fallback?: boolean;
}

export interface Post extends PostMeta {
  content: string;
  headings: Heading[];
}

const CONTENT_DIR = path.join(process.cwd(), "content");

function stripInlineMd(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_~`]+/g, "")
    .trim();
}

function readingMinutes(content: string): number {
  const cjk = (content.match(/[\u3400-\u4dbf\u4e00-\u9fff]/g) ?? []).length;
  const words = (content.replace(/[\u3400-\u4dbf\u4e00-\u9fff]/g, "").match(/[a-zA-Z0-9]+/g) ?? [])
    .length;
  const minutes = cjk / 420 + words / 220;
  return Math.max(1, Math.round(minutes));
}

function extractHeadings(content: string): Heading[] {
  const withoutCode = content.replace(/^```[\s\S]*?^```/gm, "");
  const slugger = new GithubSlugger();
  const headings: Heading[] = [];
  for (const m of withoutCode.matchAll(/^(#{2,3})\s+(.+)$/gm)) {
    const text = stripInlineMd(m[2]);
    if (!text) continue;
    headings.push({ depth: m[1].length as 2 | 3, text, slug: slugger.slug(text) });
  }
  return headings;
}

function readLangDir(lang: Lang): Post[] {
  const dir = path.join(CONTENT_DIR, lang);
  if (!fs.existsSync(dir)) return [];
  const posts: Post[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".mdx") && !file.endsWith(".md")) continue;
    const slug = file.replace(/\.(mdx|md)$/, "");
    const raw = fs.readFileSync(path.join(dir, file), "utf8");
    const { data, content } = matter(raw);
    posts.push({
      slug,
      lang,
      title: String(data.title ?? slug),
      date: data.date instanceof Date ? data.date.toISOString().slice(0, 10) : String(data.date ?? ""),
      category: (categoryKeys as string[]).includes(data.category)
        ? (data.category as CategoryKey)
        : "essay",
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      summary: String(data.summary ?? ""),
      readingMinutes: readingMinutes(content),
      content,
      headings: extractHeadings(content),
    });
  }
  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

const readLang = cache((lang: Lang) => readLangDir(lang));

/**
 * 某语言下的完整文章列表：本语言文章 + 中文文章回退（仅英文视图），
 * 缺失翻译的文章标记 fallback: true，正文回退到中文。
 */
export const getPostsForLang = cache((lang: Lang): PostMeta[] => {
  const own = readLang(lang);
  if (lang === "zh") return own;
  const slugs = new Set(own.map((p) => p.slug));
  const fallbacks = readLang("zh")
    .filter((p) => !slugs.has(p.slug))
    .map((p) => ({ ...p, lang: "en" as Lang, fallback: true }));
  return [...own, ...fallbacks].sort((a, b) => b.date.localeCompare(a.date));
});

export const getPost = cache((lang: Lang, slug: string): Post | null => {
  const own = readLang(lang).find((p) => p.slug === slug);
  if (own) return own;
  if (lang === "en") {
    const zh = readLang("zh").find((p) => p.slug === slug);
    if (zh) return { ...zh, lang: "en", fallback: true };
  }
  return null;
});

export const getLatestPost = cache((lang: Lang): PostMeta | null => {
  const list = getPostsForLang(lang);
  return list[0] ?? null;
});

export const getAdjacent = cache((lang: Lang, slug: string) => {
  const list = getPostsForLang(lang);
  const i = list.findIndex((p) => p.slug === slug);
  return { prev: i > 0 ? list[i - 1] : null, next: i >= 0 && i < list.length - 1 ? list[i + 1] : null };
});

export function getCategories(lang: Lang): { key: CategoryKey; count: number }[] {
  return categoryKeys.map((key) => ({
    key,
    count: getPostsForLang(lang).filter((p) => p.category === key).length,
  }));
}

export function getTags(lang: Lang): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of getPostsForLang(lang)) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export interface SearchDoc {
  slug: string;
  title: string;
  summary: string;
  category: CategoryKey;
  tags: string[];
  text: string;
}

export const getSearchIndex = cache((lang: Lang): SearchDoc[] => {
  const own = readLang(lang);
  const slugs = new Set(own.map((p) => p.slug));
  const source =
    lang === "zh" ? own : [...own, ...readLang("zh").filter((p) => !slugs.has(p.slug))];
  return source.map((p) => ({
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    category: p.category,
    tags: p.tags,
    text: p.content
      .replace(/^```[\s\S]*?^```/gm, " ")
      .replace(/[<>{}#*`_[\]()!]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000),
  }));
});

/** 静态生成用：每个语言 × 双语并集 slug（英文缺失时回退中文正文） */
export function allRoutes(): { lang: Lang; slug: string }[] {
  const zhSlugs = readLangDir("zh").map((p) => p.slug);
  const enSlugs = readLangDir("en").map((p) => p.slug);
  const union = [...new Set([...zhSlugs, ...enSlugs])];
  return langs.flatMap((lang) => union.map((slug) => ({ lang, slug })));
}

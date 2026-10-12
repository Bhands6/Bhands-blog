import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import matter from "gray-matter";
import GithubSlugger from "github-slugger";
import { prisma } from "./prisma";

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
  date: string; // YYYY-MM-DD（展示用）
  /** 排序键：date + 可选时间（YYYY-MM-DDTHH:MM）。仅用于排序，UI 只显示 date。
   *  没有它的话，同一天发布的文章之间比较结果为 0，排序会退化成
   *  readdirSync 的字母序 —— 表现为「最新的反而排在最下面」。 */
  sortKey: string;
  category: CategoryKey;
  tags: string[];
  summary: string;
  readingMinutes: number;
  /** 在该语言下可见、但实际只有中文原文 */
  fallback?: boolean;
  /** 文章来源：mdx = 仓库文件，db = 在线写作（可编辑） */
  source: "mdx" | "db";
  /** 在线文章的数据库 id（mdx 文章无） */
  id?: string;
}

export interface Post extends PostMeta {
  content: string;
  headings: Heading[];
}

const CONTENT_DIR = path.join(process.cwd(), "content");

/**
 * 解析 frontmatter 的 date，拆出「展示用日期」和「排序键」。
 * 支持两种写法：
 *   date: 2026-10-12                      → 排序键 2026-10-12T00:00
 *   date: 2026-10-12 15:18                → 排序键 2026-10-12T15:18（同一天多篇靠它定序）
 * gray-matter（js-yaml）遇到 YAML 时间戳会直接解析成 Date，所以两种写法都要接。
 */
function parseDate(v: unknown): { date: string; sortKey: string } {
  if (v instanceof Date) {
    const iso = v.toISOString(); // 2026-10-12T15:18:00.000Z
    return { date: iso.slice(0, 10), sortKey: iso.slice(0, 16) };
  }
  const s = String(v ?? "").trim();
  const [d, t = "00:00"] = s.split(/[T ]/);
  return { date: d, sortKey: `${d}T${t.slice(0, 5)}` };
}

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

/** 新的在前：按 sortKey（date + 可选时间）倒序 */
const byDateDesc = (a: PostMeta, b: PostMeta) => b.sortKey.localeCompare(a.sortKey);

function readLangDir(lang: Lang): Post[] {
  const dir = path.join(CONTENT_DIR, lang);
  if (!fs.existsSync(dir)) return [];
  const posts: Post[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".mdx") && !file.endsWith(".md")) continue;
    const slug = file.replace(/\.(mdx|md)$/, "");
    const raw = fs.readFileSync(path.join(dir, file), "utf8");
    const { data, content } = matter(raw);
    const { date, sortKey } = parseDate(data.date);
    posts.push({
      slug,
      lang,
      title: String(data.title ?? slug),
      date,
      sortKey,
      category: (categoryKeys as string[]).includes(data.category)
        ? (data.category as CategoryKey)
        : "essay",
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      summary: String(data.summary ?? ""),
      readingMinutes: readingMinutes(content),
      content,
      headings: extractHeadings(content),
      source: "mdx",
    });
  }
  return posts.sort(byDateDesc);
}

const readLang = cache((lang: Lang) => readLangDir(lang));

/** 在线写作的文章（MySQL）；与 MDX 同名 slug 时本地文件优先；数据库不可用则静默降级为空 */
async function dbPosts(lang: Lang): Promise<Post[]> {
  try {
    const rows = await prisma.post.findMany({
      where: { lang, status: 1 },
      orderBy: { createdAt: "desc" },
    });
    const mdxSlugs = new Set(readLang(lang).map((p) => p.slug));
    return rows
      .filter((r) => !mdxSlugs.has(r.slug))
      .map((r) => {
        const content = r.content;
        const created = r.createdAt.toISOString(); // 2026-10-12T15:18:00.000Z
        return {
          slug: r.slug,
          lang,
          title: r.title,
          date: created.slice(0, 10),
          sortKey: created.slice(0, 16),
          category: (categoryKeys as string[]).includes(r.category)
            ? (r.category as CategoryKey)
            : "essay",
          tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
          summary: r.summary,
          readingMinutes: readingMinutes(content),
          content,
          headings: extractHeadings(content),
          source: "db" as const,
          id: r.id.toString(),
        };
      });
  } catch {
    return [];
  }
}

/**
 * 某语言下的完整文章列表：MDX 文章 + 在线文章 + 中文文章回退（仅英文视图），
 * 缺失翻译的文章标记 fallback: true，正文回退到中文。
 */
export const getPostsForLang = cache(async (lang: Lang): Promise<Post[]> => {
  const own = readLang(lang);
  const ownSlugs = new Set(own.map((p) => p.slug));
  const merged = [...own, ...(await dbPosts(lang)).filter((p) => !ownSlugs.has(p.slug))];
  if (lang === "zh") return [...merged].sort(byDateDesc);
  const have = new Set(merged.map((p) => p.slug));
  const zhAll = [...readLang("zh"), ...(await dbPosts("zh"))];
  const fallbacks = zhAll
    .filter((p) => !have.has(p.slug))
    .map((p) => ({ ...p, lang: "en" as Lang, fallback: true }));
  return [...merged, ...fallbacks].sort(byDateDesc);
});

export const getPost = cache(async (lang: Lang, slug: string): Promise<Post | null> => {
  const own = readLang(lang).find((p) => p.slug === slug);
  if (own) return own;
  const db = (await dbPosts(lang)).find((p) => p.slug === slug);
  if (db) return db;
  if (lang === "en") {
    const zh = readLang("zh").find((p) => p.slug === slug);
    if (zh) return { ...zh, lang: "en", fallback: true };
    const zhDb = (await dbPosts("zh")).find((p) => p.slug === slug);
    if (zhDb) return { ...zhDb, lang: "en", fallback: true };
  }
  return null;
});

export const getLatestPost = cache(async (lang: Lang): Promise<PostMeta | null> => {
  const list = await getPostsForLang(lang);
  return list[0] ?? null;
});

export const getAdjacent = cache(async (lang: Lang, slug: string) => {
  const list = await getPostsForLang(lang);
  const i = list.findIndex((p) => p.slug === slug);
  return { prev: i > 0 ? list[i - 1] : null, next: i >= 0 && i < list.length - 1 ? list[i + 1] : null };
});

export async function getCategories(lang: Lang): Promise<{ key: CategoryKey; count: number }[]> {
  const posts = await getPostsForLang(lang);
  return categoryKeys.map((key) => ({
    key,
    count: posts.filter((p) => p.category === key).length,
  }));
}

export async function getTags(lang: Lang): Promise<{ tag: string; count: number }[]> {
  const counts = new Map<string, number>();
  for (const p of await getPostsForLang(lang)) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
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

export const getSearchIndex = cache(async (lang: Lang): Promise<SearchDoc[]> => {
  const source: Post[] = await getPostsForLang(lang);
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

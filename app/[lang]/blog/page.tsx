import Link from "next/link";
import type { Metadata } from "next";
import Reveal from "@/components/reveal";
import SiteFooter from "@/components/site-footer";
import { getDict } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import {
  categoryKeys,
  getCategories,
  getPost,
  getPostsForLang,
  getTags,
  isLang,
  type CategoryKey,
} from "@/lib/posts";

/** 列表页「热门文章」展示条数 */
const HOT_COUNT = 3;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : "zh";
  const t = getDict(lang);
  return { title: t.nav.blog, description: t.blog.subtitle };
}

export default async function BlogPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ category?: string; tag?: string }>;
}) {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : "zh";
  const sp = await searchParams;
  const t = getDict(lang);

  const category: CategoryKey | undefined = categoryKeys.includes(sp.category as CategoryKey)
    ? (sp.category as CategoryKey)
    : undefined;
  const tag = typeof sp.tag === "string" && sp.tag ? sp.tag : undefined;

  const all = await getPostsForLang(lang);
  const posts = all.filter(
    (p) => (!category || p.category === category) && (!tag || p.tags.includes(tag))
  );
  const categories = await getCategories(lang);
  const tags = await getTags(lang);

  const href = (c?: string, tg?: string) => {
    const usp = new URLSearchParams();
    if (c) usp.set("category", c);
    if (tg) usp.set("tag", tg);
    const q = usp.toString();
    return `/${lang}/blog${q ? `?${q}` : ""}`;
  };

  // 阅读量 + 热榜（数据库不可用时静默降级，不影响列表）
  let viewsBySlug = new Map<string, number>();
  let hot: { slug: string; title: string; views: number }[] = [];
  try {
    const stats = await prisma.postStat.findMany({
      where: { postLang: lang, views: { gt: 0 } },
      orderBy: { views: "desc" },
    });
    viewsBySlug = new Map(stats.map((s) => [s.postSlug, Number(s.views)]));

    // 热榜必须带次级排序键：views 全相等时 SQL 的返回顺序是不确定的，
    // 实测会退化成 slug 字母序 —— 看起来像「写得最早的最热门」。
    // 统一口径为「浏览量 desc，发布时间 desc」，与 /api/v1/posts/hot 保持一致。
    const ranked = await Promise.all(
      stats.map(async (s) => {
        const post = await getPost(lang, s.postSlug);
        return post
          ? { slug: s.postSlug, title: post.title, views: Number(s.views), sortKey: post.sortKey }
          : null;
      }),
    );
    hot = ranked
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.views - a.views || b.sortKey.localeCompare(a.sortKey))
      .slice(0, HOT_COUNT)
      .map(({ slug, title, views }) => ({ slug, title, views }));
  } catch {
    // 数据库不可达时保持空
  }

  return (
    <>
      <div className="mx-auto max-w-5xl px-6 pt-36">
        <h1 className="giant-latin">BLOG</h1>
        <p className="mt-4 text-sm tracking-[0.2em] text-faint uppercase">{t.blog.subtitle}</p>

        {/* 分类 + 标签筛选 */}
        <div className="mt-12 flex flex-wrap items-center gap-2">
          <Link
            href={href()}
            className={`rounded-full border px-4 py-2 text-sm transition-all ${
              !category && !tag
                ? "border-cyan bg-cyan font-medium text-black shadow-[0_0_20px_rgba(0,229,255,0.5)]"
                : "border-line text-dim hover:border-cyan hover:text-cyan"
            }`}
          >
            {t.blog.all}
          </Link>
          {categories.map((c) => (
            <Link
              key={c.key}
              href={href(c.key)}
              className={`rounded-full border px-4 py-2 text-sm transition-all ${
                category === c.key
                  ? "border-cyan bg-cyan font-medium text-black shadow-[0_0_20px_rgba(0,229,255,0.5)]"
                  : "border-line text-dim hover:border-cyan hover:text-cyan"
              }`}
            >
              {t.category[c.key]}
              <span className="ml-1.5 text-xs opacity-60">{c.count}</span>
            </Link>
          ))}
        </div>
        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-xs tracking-[0.14em] text-faint uppercase">{t.blog.tags}</span>
            {tags.map((tagItem) => (
              <Link
                key={tagItem.tag}
                href={href(undefined, tagItem.tag)}
                className={`transition-colors hover:text-cyan ${
                  tag === tagItem.tag ? "text-cyan underline underline-offset-4" : "text-dim"
                }`}
              >
                #{tagItem.tag}
              </Link>
            ))}
          </div>
        )}

        {hot.length > 0 && (
          <div className="hot-strip">
            <span className="hot-label">SEC // {t.blog.hot}</span>
            <div className="hot-items">
              {hot.map((h, i) => (
                <Link key={h.slug} href={`/${lang}/blog/${h.slug}`} className="hot-item">
                  <span className="hot-rank">{String(i + 1).padStart(2, "0")}</span>
                  <span className="hot-title">{h.title}</span>
                  <span className="hot-views">◇ {h.views}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 文章列表 */}
        <dl className="mt-14 pb-4">
          {posts.map((p, i) => (
            <Reveal key={`${p.slug}-${p.lang}`} delay={Math.min(i * 0.05, 0.4)}>
              <Link
                href={`/${lang}/blog/${p.slug}`}
                data-cursor-label={t.landing.enter}
                className="group block"
              >
                <div className="fact-row py-6 transition-colors group-hover:bg-white/[0.03]">
                  <dt className="pt-1.5 text-sm font-normal text-dim tabular-nums">{p.date}</dt>
                  <dd>
                    <div className="flex items-baseline justify-between gap-4">
                      <h2 className="text-xl font-bold text-white">{p.title}</h2>
                      {p.fallback && (
                        <span className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[11px] text-dim">
                          中文原文
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-7 text-dim">{p.summary}</p>
                    <p className="mt-3 text-xs text-faint">
                      {t.category[p.category]} · {t.post.minutes(p.readingMinutes)}
                      {p.tags.length > 0 && <span> · {p.tags.join(" / ")}</span>}
                      {viewsBySlug.has(p.slug) && <span> · {t.blog.views(viewsBySlug.get(p.slug)!)}</span>}
                    </p>
                  </dd>
                </div>
              </Link>
            </Reveal>
          ))}
        </dl>
        {posts.length === 0 && <p className="py-20 text-center text-dim">{t.blog.empty}</p>}
      </div>
      <SiteFooter lang={lang} />
    </>
  );
}

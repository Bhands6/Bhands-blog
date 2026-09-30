import Link from "next/link";
import type { Metadata } from "next";
import Reveal from "@/components/reveal";
import SiteFooter from "@/components/site-footer";
import { getDict } from "@/lib/i18n";
import {
  categoryKeys,
  getCategories,
  getPostsForLang,
  getTags,
  isLang,
  type CategoryKey,
} from "@/lib/posts";

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

  const all = getPostsForLang(lang);
  const posts = all.filter(
    (p) => (!category || p.category === category) && (!tag || p.tags.includes(tag))
  );
  const categories = getCategories(lang);
  const tags = getTags(lang);

  const href = (c?: string, tg?: string) => {
    const usp = new URLSearchParams();
    if (c) usp.set("category", c);
    if (tg) usp.set("tag", tg);
    const q = usp.toString();
    return `/${lang}/blog${q ? `?${q}` : ""}`;
  };

  return (
    <>
      <div className="mx-auto max-w-5xl px-6 pt-36">
        <h1 className="giant-latin">BLOG</h1>
        <p className="mt-4 text-sm tracking-[0.2em] text-faint uppercase">{t.blog.subtitle}</p>

        {/* 分类 + 标签筛选 */}
        <div className="mt-12 flex flex-wrap items-center gap-2">
          <Link
            href={href()}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${
              !category && !tag
                ? "border-white bg-white text-black"
                : "border-line text-dim hover:border-white hover:text-white"
            }`}
          >
            {t.blog.all}
          </Link>
          {categories.map((c) => (
            <Link
              key={c.key}
              href={href(c.key)}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                category === c.key
                  ? "border-white bg-white text-black"
                  : "border-line text-dim hover:border-white hover:text-white"
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
                className={`transition-colors hover:text-white ${
                  tag === tagItem.tag ? "text-white underline underline-offset-4" : "text-dim"
                }`}
              >
                #{tagItem.tag}
              </Link>
            ))}
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

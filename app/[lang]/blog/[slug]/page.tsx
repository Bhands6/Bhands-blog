import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteFooter from "@/components/site-footer";
import Toc from "@/components/toc";
import Comments from "@/components/comments";
import PostReactions from "@/components/post-reactions";
import { getDict } from "@/lib/i18n";
import { allRoutes, getAdjacent, getPost, isLang } from "@/lib/posts";
import { evaluate } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeShiki from "@shikijs/rehype";

export function generateStaticParams() {
  return allRoutes();
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang: raw, slug } = await params;
  const lang = isLang(raw) ? raw : "zh";
  const post = getPost(lang, slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.summary,
    openGraph: {
      title: post.title,
      description: post.summary,
      type: "article",
      publishedTime: post.date,
      tags: post.tags,
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang: raw, slug } = await params;
  const lang = isLang(raw) ? raw : "zh";
  const post = getPost(lang, slug);
  if (!post) notFound();
  const t = getDict(lang);
  const { prev, next } = getAdjacent(lang, slug);

  const { default: MDXContent } = await evaluate(post.content, {
    ...(runtime as unknown as Record<string, unknown>),
    remarkPlugins: [remarkGfm],
    rehypePlugins: [
      rehypeSlug,
      [rehypeShiki, { theme: "tokyo-night", fallbackLanguage: "plain" }],
    ],
  } as unknown as Parameters<typeof evaluate>[1]);

  return (
    <>
      <article className="mx-auto max-w-3xl px-6 pt-36">
        <h1 className="giant-zh">{post.title}</h1>

        <dl className="mt-10">
          <div className="fact-row">
            <dt>{t.post.date}</dt>
            <dd className="tabular-nums">{post.date}</dd>
          </div>
          <div className="fact-row">
            <dt>{t.post.category}</dt>
            <dd>
              <Link
                href={`/${lang}/blog?category=${post.category}`}
                className="text-cyan underline underline-offset-4 decoration-cyan/50 hover:decoration-cyan"
              >
                {t.category[post.category]}
              </Link>
            </dd>
          </div>
          <div className="fact-row">
            <dt>{t.post.read}</dt>
            <dd>{t.post.minutes(post.readingMinutes)}</dd>
          </div>
          {post.tags.length > 0 && (
            <div className="fact-row">
              <dt>{t.post.tags}</dt>
              <dd className="flex flex-wrap gap-x-3">
                {post.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/${lang}/blog?tag=${encodeURIComponent(tag)}`}
                    className="text-cyan underline underline-offset-4 decoration-cyan/50 hover:decoration-cyan"
                  >
                    #{tag}
                  </Link>
                ))}
              </dd>
            </div>
          )}
        </dl>

        {post.fallback && (
          <p className="mt-8 rounded-lg border border-line-soft bg-white/[0.04] px-4 py-3 text-sm text-dim">
            {t.post.fallbackNotice}
          </p>
        )}

        <PostReactions lang={lang} slug={post.slug} />

        <div className="mt-14 grid gap-12 xl:grid-cols-[1fr_220px]">
          <div className="article-body min-w-0">
            <MDXContent />
          </div>
          <aside className="hidden xl:block">
            <div className="sticky top-28">
              <p className="mb-4 text-xs font-bold tracking-[0.14em] text-faint uppercase">
                {t.post.toc}
              </p>
              <Toc headings={post.headings} label={t.post.toc} />
            </div>
          </aside>
        </div>

        <nav className="mt-20 grid gap-8 border-t border-line-soft pt-8 sm:grid-cols-2">
          {prev ? (
            <Link href={`/${lang}/blog/${prev.slug}`} data-cursor-label={t.landing.enter} className="group">
              <p className="text-xs text-faint">← {t.post.prev}</p>
              <p className="mt-2 font-bold group-hover:underline underline-offset-4">{prev.title}</p>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link
              href={`/${lang}/blog/${next.slug}`}
              data-cursor-label={t.landing.enter}
              className="group sm:text-right"
            >
              <p className="text-xs text-faint">{t.post.next} →</p>
              <p className="mt-2 font-bold group-hover:underline underline-offset-4">{next.title}</p>
            </Link>
          )}
        </nav>

        <Comments
          title={t.post.comments}
          lang={lang}
          slug={post.slug}
          loginHref={`/${lang}/login`}
          loginLabel={t.nexus.login}
        />
      </article>
      <SiteFooter lang={lang} />
    </>
  );
}

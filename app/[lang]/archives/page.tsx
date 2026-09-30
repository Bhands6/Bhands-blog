import Link from "next/link";
import type { Metadata } from "next";
import Reveal from "@/components/reveal";
import SiteFooter from "@/components/site-footer";
import { getDict } from "@/lib/i18n";
import { getPostsForLang, isLang, type PostMeta } from "@/lib/posts";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : "zh";
  const t = getDict(lang);
  return { title: t.nav.archives, description: t.archives.subtitle };
}

export default async function ArchivesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : "zh";
  const t = getDict(lang);
  const posts = getPostsForLang(lang);

  const groups = new Map<string, PostMeta[]>();
  for (const p of posts) {
    const year = p.date.slice(0, 4);
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year)!.push(p);
  }

  return (
    <>
      <div className="mx-auto max-w-5xl px-6 pt-36">
        <h1 className="giant-latin">ARCHIVE</h1>
        <p className="mt-4 text-sm tracking-[0.2em] text-faint uppercase">{t.archives.subtitle}</p>

        <div className="mt-16 space-y-16 pb-4">
          {[...groups.entries()].map(([year, yearPosts]) => (
            <section key={year}>
              <h2 className="font-display text-6xl text-white/90">{year}</h2>
              <dl className="mt-6">
                {yearPosts.map((p, i) => (
                  <Reveal key={`${p.slug}-${p.lang}`} delay={Math.min(i * 0.04, 0.3)}>
                    <Link
                      href={`/${lang}/blog/${p.slug}`}
                      data-cursor-label={t.landing.enter}
                      className="group block"
                    >
                      <div className="fact-row py-4 transition-colors group-hover:bg-white/[0.03]">
                        <dt className="pt-0.5 text-sm font-normal text-dim tabular-nums">
                          {p.date}
                        </dt>
                        <dd className="flex items-baseline justify-between gap-4">
                          <span className="font-bold group-hover:underline underline-offset-4">
                            {p.title}
                          </span>
                          <span className="shrink-0 text-xs text-faint">
                            {t.category[p.category]}
                          </span>
                        </dd>
                      </div>
                    </Link>
                  </Reveal>
                ))}
              </dl>
            </section>
          ))}
          {posts.length === 0 && <p className="py-20 text-center text-dim">{t.archives.empty}</p>}
        </div>
      </div>
      <SiteFooter lang={lang} />
    </>
  );
}

import type { Metadata } from "next";
import AboutEditor from "@/components/about-editor";
import Reveal from "@/components/reveal";
import SiteFooter from "@/components/site-footer";
import { getDict } from "@/lib/i18n";
import { isLang } from "@/lib/posts";
import { getAboutContent } from "@/lib/site-content";
import { site } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : "zh";
  const t = getDict(lang);
  const content = await getAboutContent(lang);
  return { title: t.nav.about, description: content.paragraphs[0] ?? t.about.subtitle };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : "zh";
  const t = getDict(lang);
  // 数据库优先，无记录时回落 i18n 默认值 —— 表为空也不影响渲染
  const content = await getAboutContent(lang);

  return (
    <>
      <div className="mx-auto max-w-5xl px-6 pt-36">
        <h1 className="giant-latin">ABOUT</h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          <p className="text-sm tracking-[0.2em] text-faint uppercase">{t.about.subtitle}</p>
          <AboutEditor lang={lang} initial={content} />
        </div>

        <div className="mt-16 grid gap-16 pb-4 md:grid-cols-[1fr_447px]">
          <div className="space-y-5 text-lg leading-9 text-white/85">
            {content.paragraphs.map((paragraph, i) => (
              <Reveal key={`p-${i}`} delay={Math.min(i, 5) * 0.08}>
                <p>{paragraph}</p>
              </Reveal>
            ))}
            <Reveal delay={0.3}>
              <div className="flex flex-wrap gap-3 pt-2">
                <a
                  href={site.socials.github}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-line px-5 py-2.5 text-sm text-dim transition-colors hover:border-cyan hover:text-cyan"
                >
                  GitHub
                </a>
                <a
                  href={site.socials.email}
                  className="rounded-full border border-line px-5 py-2.5 text-sm text-dim transition-colors hover:border-cyan hover:text-cyan"
                >
                  Email
                </a>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.15}>
            <dl>
              {content.facts.map((f, i) => (
                <div className="fact-row" key={`f-${i}-${f.k}`}>
                  <dt>{f.k}</dt>
                  <dd>{f.v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </div>
      <SiteFooter lang={lang} />
    </>
  );
}

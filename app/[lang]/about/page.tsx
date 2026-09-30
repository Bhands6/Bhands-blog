import type { Metadata } from "next";
import Reveal from "@/components/reveal";
import SiteFooter from "@/components/site-footer";
import { getDict } from "@/lib/i18n";
import { isLang } from "@/lib/posts";
import { site } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : "zh";
  const t = getDict(lang);
  return { title: t.nav.about, description: t.about.paragraphs[0] };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : "zh";
  const t = getDict(lang);

  const facts = [
    ...t.landing.facts.map((f) => ({ k: f.k, v: f.v })),
    { k: t.about.stackLabel, v: t.about.stack },
  ];

  return (
    <>
      <div className="mx-auto max-w-5xl px-6 pt-36">
        <h1 className="giant-latin">ABOUT</h1>
        <p className="mt-4 text-sm tracking-[0.2em] text-faint uppercase">{t.about.subtitle}</p>

        <div className="mt-16 grid gap-16 pb-4 md:grid-cols-[1fr_447px]">
          <div className="space-y-5 text-lg leading-9 text-white/85">
            {t.about.paragraphs.map((paragraph, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <p>{paragraph}</p>
              </Reveal>
            ))}
            <Reveal delay={0.3}>
              <div className="flex flex-wrap gap-3 pt-2">
                <a
                  href={site.socials.github}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-line px-5 py-2.5 text-sm text-dim transition-colors hover:border-white hover:text-white"
                >
                  GitHub
                </a>
                <a
                  href={site.socials.email}
                  className="rounded-full border border-line px-5 py-2.5 text-sm text-dim transition-colors hover:border-white hover:text-white"
                >
                  Email
                </a>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.15}>
            <dl>
              {facts.map((f) => (
                <div className="fact-row" key={f.k}>
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

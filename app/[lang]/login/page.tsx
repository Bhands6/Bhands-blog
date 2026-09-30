import type { Metadata } from "next";
import Starfield from "@/components/starfield";
import AuthPanel from "@/components/auth-panel";
import { getDict } from "@/lib/i18n";
import { isLang } from "@/lib/posts";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : "zh";
  const t = getDict(lang);
  return { title: t.auth.metaTitle };
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : "zh";
  const t = getDict(lang);

  return (
    <>
      <Starfield />
      <div className="glow-orb cyan" aria-hidden="true" />
      <div className="glow-orb magenta" aria-hidden="true" />
      <div className="nx-auth-bg-grid" aria-hidden="true" />

      <div className="auth-layout">
        <div className="info-panel">
          <div className="info-logo">
            <span className="dot" aria-hidden="true" />
            {t.nexus.brand}
          </div>
          <div className="info-title">{t.auth.info.title}</div>
          <p className="info-desc">{t.auth.info.desc}</p>
          <div className="info-stats">
            {t.auth.info.stats.map((s) => (
              <div key={s.k}>
                <div className="info-stat-val">{s.v}</div>
                <div className="info-stat-label">{s.k}</div>
              </div>
            ))}
          </div>
        </div>

        <AuthPanel labels={t.auth.card} lang={lang} />
      </div>
    </>
  );
}

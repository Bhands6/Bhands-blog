import Link from "next/link";
import { getDict } from "@/lib/i18n";
import type { Lang } from "@/lib/posts";

type FooterCol = {
  readonly title: string;
  readonly links: ReadonlyArray<{ readonly label: string; readonly href: string }>;
};

function Col({ col, lang }: { col: FooterCol; lang: Lang }) {
  return (
    <div className="footer-col">
      <div className="footer-col-title">{col.title}</div>
      {col.links.map((l) => (
        <Link key={l.label} href={`/${lang}${l.href}`}>
          {l.label}
        </Link>
      ))}
    </div>
  );
}

/** NEXUS STATION 页脚（移植自 nexus-station/index.html） */
export default function SiteFooter({ lang }: { lang: Lang }) {
  const t = getDict(lang);
  return (
    <footer className="nx-footer">
      <div className="footer-grid">
        <div>
          <div className="footer-brand">{t.nexus.brand}</div>
          <p className="footer-desc">{t.nexus.footer.desc}</p>
        </div>
        <Col col={t.nexus.footer.colNav} lang={lang} />
        <Col col={t.nexus.footer.colRes} lang={lang} />
        <Col col={t.nexus.footer.colAbout} lang={lang} />
      </div>
      <div className="footer-bottom">
        <div className="footer-copy">
          © <span className="highlight">{new Date().getFullYear()}</span> {t.nexus.brand} · {t.footer.rights}
        </div>
        <div className="footer-copy">{t.nexus.footer.sysline}</div>
      </div>
    </footer>
  );
}

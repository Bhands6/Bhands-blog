"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "./logo-mark";
import { getDict } from "@/lib/i18n";
import type { Lang } from "@/lib/posts";

function withLang(pathname: string, lang: Lang): string {
  const rest = pathname.replace(/^\/(zh|en)/, "");
  return `/${lang}${rest === "/" || rest === "" ? "" : rest}`;
}

export default function SiteHeader({ lang }: { lang: Lang }) {
  const pathname = usePathname() ?? `/${lang}`;
  const t = getDict(lang);
  const seg = (p: string) => `/${lang}${p}`;
  const isActive = (p: string) =>
    p === "/blog"
      ? pathname.startsWith(seg("/blog"))
      : pathname === seg(p) || pathname.startsWith(`${seg(p)}/`);

  const items = [
    { href: "/blog", label: t.nav.blog },
    { href: "/archives", label: t.nav.archives },
    { href: "/search", label: t.nav.search },
    { href: "/about", label: t.nav.about },
  ];

  return (
    <header
      className="chrome fixed z-10 flex items-center justify-between"
      style={{
        left: "clamp(18px, 1.95vw, 28px)",
        right: "clamp(18px, 1.95vw, 28px)",
        top: "clamp(18px, 3.1vh, 28px)",
      }}
    >
      <Link href={`/${lang}`} aria-label={lang === "zh" ? "回到首页" : "Home"}>
        <LogoMark />
      </Link>
      <div className="flex items-center gap-3 max-[640px]:hidden">
        <nav className="pill-nav" aria-label="Primary">
          {items.map((item) => (
            <Link
              key={item.href}
              href={seg(item.href)}
              className={isActive(item.href) ? "active" : ""}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="pill-lang" aria-label="Language">
          <Link href={withLang(pathname, "zh")} className={lang === "zh" ? "active" : ""}>
            中
          </Link>
          <Link href={withLang(pathname, "en")} className={lang === "en" ? "active" : ""}>
            EN
          </Link>
        </div>
      </div>
      {/* 移动端精简：只保留语言切换 */}
      <div className="pill-lang max-[640px]:flex hidden" aria-label="Language">
        <Link href={withLang(pathname, "zh")} className={lang === "zh" ? "active" : ""}>
          中
        </Link>
        <Link href={withLang(pathname, "en")} className={lang === "en" ? "active" : ""}>
          EN
        </Link>
      </div>
    </header>
  );
}

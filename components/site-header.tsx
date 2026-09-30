"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getDict } from "@/lib/i18n";
import type { Lang } from "@/lib/posts";
import {
  getAuth,
  getServerAuth,
  logout as authLogout,
  subscribeAuth,
} from "@/lib/auth-client";

function withLang(pathname: string, lang: Lang): string {
  const rest = pathname.replace(/^\/(zh|en)/, "");
  return `/${lang}${rest === "/" || rest === "" ? "" : rest}`;
}

/** NEXUS 风格顶部导航：博客站点链接（NEXUS STATION 主题移植） */
export default function SiteHeader({ lang }: { lang: Lang }) {
  const pathname = usePathname() ?? `/${lang}`;
  const t = getDict(lang);
  const [scrolled, setScrolled] = useState(false);
  const user = useSyncExternalStore(subscribeAuth, getAuth, getServerAuth);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
    <nav className={`nx-nav ${scrolled ? "scrolled" : ""}`} role="navigation" aria-label="Main navigation">
      <Link href={`/${lang}`} className="nx-nav-logo" aria-label={lang === "zh" ? "回到首页" : "Home"}>
        <span className="logo-dot" aria-hidden="true" />
        {t.nexus.brand}
      </Link>
      <ul className="nx-nav-links nx-nav-pages">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={seg(item.href)} className={isActive(item.href) ? "active" : ""}>
              {item.label}
            </Link>
          </li>
        ))}
        {user?.role === "ADMIN" && (
          <li>
            <Link
              href={`/${lang}/admin`}
              className={pathname.startsWith(`/${lang}/admin`) ? "active" : ""}
            >
              {t.nexus.admin}
            </Link>
          </li>
        )}
        {user ? (
          <>
            <li>
              <span className="nx-user-chip" title={user.displayName}>
                <span className="user-dot" aria-hidden="true" />
                {user.displayName}
              </span>
            </li>
            <li>
              <button type="button" className="nx-logout" onClick={() => void authLogout()}>
                {t.nexus.logout}
              </button>
            </li>
          </>
        ) : (
          <li>
            <Link
              href={`/${lang}/login`}
              className={pathname.startsWith(`/${lang}/login`) ? "active" : ""}
            >
              {t.nexus.login}
            </Link>
          </li>
        )}
      </ul>
      <div className="nx-nav-right">
        <div className="nx-lang" aria-label="Language">
          <Link href={withLang(pathname, "zh")} className={lang === "zh" ? "active" : ""}>
            中
          </Link>
          <Link href={withLang(pathname, "en")} className={lang === "en" ? "active" : ""}>
            EN
          </Link>
        </div>
        <div className="nx-nav-status">
          <span className="live-dot" aria-hidden="true" />
          {t.nexus.relay}
        </div>
      </div>
    </nav>
  );
}

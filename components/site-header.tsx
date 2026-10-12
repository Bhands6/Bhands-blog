"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
  const router = useRouter();
  const t = getDict(lang);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const user = useSyncExternalStore(subscribeAuth, getAuth, getServerAuth);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 点击外部 / Esc 关闭用户菜单
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

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
        {user ? (
          <div className="nx-user-menu" ref={menuRef}>
            <button
              type="button"
              className="nx-user-chip"
              title={user.displayName}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="user-dot" aria-hidden="true" />
              {user.displayName}
            </button>
            {menuOpen && (
              <div className="nx-user-dropdown" role="menu">
                {user.role === "ADMIN" && (
                  <Link
                    href={`/${lang}/write`}
                    className="nx-dropdown-item"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                  >
                    {t.nexus.write}
                  </Link>
                )}
                <button
                  type="button"
                  className="nx-logout"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    void (async () => {
                      await authLogout();
                      // 退出后回首页；否则会停在 /admin、/write 的守卫空白页上
                      if (pathname !== `/${lang}`) router.replace(`/${lang}`);
                    })();
                  }}
                >
                  {t.nexus.logout}
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            href={`/${lang}/login`}
            className={`nx-login-link${pathname.startsWith(`/${lang}/login`) ? " active" : ""}`}
          >
            {t.nexus.login}
          </Link>
        )}
      </div>
    </nav>
  );
}

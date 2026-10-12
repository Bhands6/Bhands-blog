"use client";

import { useSyncExternalStore } from "react";
import { getDict } from "@/lib/i18n";
import type { Lang } from "@/lib/posts";

/**
 * 右下角「回到顶部」。
 * 用 useSyncExternalStore 订阅滚动位置，而不是 useState + effect 里 setState
 * （后者会被 react-hooks/set-state-in-effect 规则拦下）。
 */

/** 滚过一屏多一点之后才显示，避免在页首晃眼 */
const SHOW_AFTER = 480;

const subscribe = (onChange: () => void) => {
  window.addEventListener("scroll", onChange, { passive: true });
  window.addEventListener("resize", onChange, { passive: true });
  return () => {
    window.removeEventListener("scroll", onChange);
    window.removeEventListener("resize", onChange);
  };
};

const getSnapshot = () => window.scrollY > SHOW_AFTER;
// 服务端与 hydration 阶段一律不显示（客户端接管后再按实际滚动位置决定）
const getServerSnapshot = () => false;

export default function BackToTop({ lang }: { lang: Lang }) {
  const t = getDict(lang);
  const visible = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toTop = () => {
    // 全局已有 scroll-behavior: smooth，但这里显式判断，尊重「减少动态效果」偏好
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      className={`back-to-top${visible ? " show" : ""}`}
      onClick={toTop}
      aria-label={t.nexus.backToTop}
      title={t.nexus.backToTop}
      tabIndex={visible ? 0 : -1}
    >
      <span className="btt-arrow" aria-hidden="true">
        ↑
      </span>
      <span className="btt-label">{t.nexus.backToTop}</span>
    </button>
  );
}

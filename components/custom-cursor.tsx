"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * 自定义光标：12px 白点（精确跟随）+ 36px 圆环（lerp 跟随）。
 * 悬停带 data-cursor-label 的元素时圆环放大并显示文字（如「阅读」）。
 * 仅在精确指针设备上启用；触屏与 reduced-motion 下由 CSS/守卫隐藏。
 */
export default function CustomCursor() {
  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const pathname = usePathname();

  // 路由切换时清掉残留的悬停标签
  useEffect(() => {
    ringRef.current?.classList.remove("is-active");
    if (labelRef.current) labelRef.current.textContent = "";
  }, [pathname]);

  useEffect(() => {
    const ring = ringRef.current;
    const dot = dotRef.current;
    if (!ring || !dot) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!fine) return;
    const root = document.documentElement;
    root.classList.add("has-cursor");

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let rx = x;
    let ry = y;
    let visible = false;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!visible) {
        visible = true;
        ring.classList.add("is-visible");
        dot.classList.add("is-visible");
      }
      const target = (e.target as Element | null)?.closest("[data-cursor-label]");
      const label = target?.getAttribute("data-cursor-label") ?? "";
      ring.classList.toggle("is-active", Boolean(label));
      if (labelRef.current) labelRef.current.textContent = label;
    };
    const onLeave = () => {
      visible = false;
      ring.classList.remove("is-visible");
      dot.classList.remove("is-visible");
    };
    const loop = () => {
      rx += (x - rx) * 0.2;
      ry += (y - ry) * 0.2;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
      root.classList.remove("has-cursor");
    };
  }, []);

  return (
    <>
      <div ref={ringRef} className="custom-cursor" aria-hidden="true">
        <span className="cursor-ring" />
        <span ref={labelRef} className="cursor-label" />
      </div>
      <div ref={dotRef} className="custom-cursor" aria-hidden="true">
        <span className="cursor-dot" />
      </div>
    </>
  );
}

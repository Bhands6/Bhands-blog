"use client";

import { useEffect, useState } from "react";
import type { Heading } from "@/lib/posts";

/** 文章目录 + 滚动高亮当前小节 */
export default function Toc({ headings, label }: { headings: Heading[]; label: string }) {
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const els = headings
      .map((h) => document.getElementById(h.slug))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-80px 0px -70% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [headings]);

  if (!headings.length) return null;
  return (
    <nav className="toc" aria-label={label}>
      {headings.map((h) => (
        <a
          key={h.slug}
          href={`#${h.slug}`}
          className={`${h.depth === 3 ? "toc-h3 " : ""}${active === h.slug ? "active" : ""}`}
        >
          {h.text}
        </a>
      ))}
    </nav>
  );
}

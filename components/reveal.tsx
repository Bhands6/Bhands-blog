"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/** 进入视口时做 blur + 上升揭示 */
export default function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("rv-in");
          io.disconnect();
        }
      },
      { threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`rv ${className}`}
      style={{ "--rv-delay": `${delay}s` } as CSSProperties}
    >
      {children}
    </div>
  );
}

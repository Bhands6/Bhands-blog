"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/** 进入视口时揭示；variant 控制方向（默认向上） */
export default function Reveal({
  children,
  delay = 0,
  className = "",
  variant = "up",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  variant?: "up" | "left" | "right";
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

  const variantCls = variant === "left" ? "rv-left" : variant === "right" ? "rv-right" : "";

  return (
    <div
      ref={ref}
      className={`rv ${variantCls} ${className}`}
      style={{ "--rv-delay": `${delay}s` } as CSSProperties}
    >
      {children}
    </div>
  );
}

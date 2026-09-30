"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    twikoo?: { init(options: { envId: string; el: HTMLElement }): void };
  }
}

/**
 * Twikoo 评论（自托管）。未设置 NEXT_PUBLIC_TWIKOO_URL 时不渲染任何内容。
 * 部署 Twikoo 后在环境变量里填服务地址即可启用。
 */
export default function Twikoo({ title }: { title: string }) {
  const url = process.env.NEXT_PUBLIC_TWIKOO_URL;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!url || !ref.current) return;
    const el = ref.current;
    const script = document.createElement("script");
    script.src =
      process.env.NEXT_PUBLIC_TWIKOO_CDN ??
      "https://registry.npmmirror.com/twikoo/1.6.44/files/dist/twikoo.all.min.js";
    script.onload = () => window.twikoo?.init({ envId: url, el });
    document.head.appendChild(script);
  }, [url]);

  if (!url) return null;
  return (
    <section className="mt-20 border-t border-line-soft pt-10">
      <h2 className="mb-8 text-sm font-bold tracking-[0.14em] text-faint uppercase">{title}</h2>
      <div ref={ref} />
    </section>
  );
}

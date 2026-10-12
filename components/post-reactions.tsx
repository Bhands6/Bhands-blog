"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { getAuth, getServerAuth, subscribeAuth } from "@/lib/auth-client";
import { getDict } from "@/lib/i18n";
import type { Lang } from "@/lib/posts";

/** 点赞 + 浏览量（数据来自 /api/v1/posts/{lang}/{slug}/like 与 /view） */
export default function PostReactions({ lang, slug }: { lang: Lang; slug: string }) {
  const router = useRouter();
  const t = getDict(lang);
  const user = useSyncExternalStore(subscribeAuth, getAuth, getServerAuth);
  const [count, setCount] = useState(0);
  const [views, setViews] = useState(0);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadStats = useCallback(async () => {
    const url = `/api/v1/posts/${lang}/${slug}/like`;
    try {
      const res = await fetch(url); // Cookie 自动携带，服务端识别登录态
      if (!res?.ok) return;
      const data = (await res.json()) as { liked: boolean; count: number; views: number };
      setLiked(data.liked);
      setCount(data.count);
      setViews(data.views);
    } catch {
      // 静默失败：互动数据非关键内容
    }
  }, [lang, slug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 互动数据只能在挂载后拉取
    void loadStats();
  }, [loadStats]);

  // 浏览打点：服务端按 IP+天去重。打点接口会回传最新浏览量，用它覆盖显示值 ——
  // 下面的 loadStats() 与这里是并发发出的，不覆盖的话页面会停在打点前的旧数字
  useEffect(() => {
    let alive = true;
    fetch(`/api/v1/posts/${lang}/${slug}/view`, { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { views?: number } | null) => {
        if (alive && d && typeof d.views === "number") setViews(d.views);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [lang, slug]);

  const toggle = async () => {
    if (busy) return;
    if (!user) {
      router.push(`/${lang}/login`);
      return;
    }
    setBusy(true);
    try {
      const { authFetch } = await import("@/lib/auth-client");
      const res = await authFetch(`/api/v1/posts/${lang}/${slug}/like`, { method: "PUT" });
      if (res && res.ok) {
        const data = (await res.json()) as { liked: boolean; count: number; views: number };
        setLiked(data.liked);
        setCount(data.count);
        setViews(data.views);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="post-reactions">
      <button
        type="button"
        className={`like-btn ${liked ? "liked" : ""}`}
        onClick={() => void toggle()}
        disabled={busy}
        aria-pressed={liked}
      >
        <svg viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2z" strokeLinejoin="round" />
        </svg>
        {count}
      </button>
      <span className="views-chip" title={t.post.views}>
        ◇ {views} {t.post.views}
      </span>
    </div>
  );
}

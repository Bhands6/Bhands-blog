"use client";

import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { authFetch, getAuth, getServerAuth, subscribeAuth } from "@/lib/auth-client";
import type { Lang } from "@/lib/posts";

/** 在线文章详情页的「删除」入口，仅 ADMIN 可见 */
export default function DeletePostButton({ lang, postId }: { lang: Lang; postId: string }) {
  const router = useRouter();
  const user = useSyncExternalStore(subscribeAuth, getAuth, getServerAuth);
  if (!user || user.role !== "ADMIN") return null;

  const remove = async () => {
    const msg = lang === "zh" ? "永久删除这篇文章？" : "Permanently delete this post?";
    if (!window.confirm(msg)) return;
    const res = await authFetch(`/api/v1/posts/manage/${postId}`, { method: "DELETE" });
    if (res?.ok) {
      router.push(`/${lang}/blog`);
      router.refresh();
    }
  };

  return (
    <button type="button" className="delete-post-link" onClick={() => void remove()}>
      ✕ {lang === "zh" ? "删除" : "Delete"}
    </button>
  );
}

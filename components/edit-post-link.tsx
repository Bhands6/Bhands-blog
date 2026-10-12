"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { getAuth, getServerAuth, subscribeAuth } from "@/lib/auth-client";
import type { Lang } from "@/lib/posts";

/** 在线文章详情页的「编辑」入口，仅 ADMIN 可见 */
export default function EditPostLink({ lang, postId }: { lang: Lang; postId: string }) {
  const user = useSyncExternalStore(subscribeAuth, getAuth, getServerAuth);
  if (!user || user.role !== "ADMIN") return null;
  return (
    <Link href={`/${lang}/write?id=${postId}`} className="edit-post-link">
      ✎ {lang === "zh" ? "编辑" : "Edit"}
    </Link>
  );
}

"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { getAuth, getServerAuth, subscribeAuth } from "@/lib/auth-client";
import type { Lang } from "@/lib/posts";

/** 首页主 CTA：已登录直达博客页，未登录去登录页 */
export default function HeroCta({ lang, label }: { lang: Lang; label: string }) {
  const user = useSyncExternalStore(subscribeAuth, getAuth, getServerAuth);
  return (
    <Link href={user ? `/${lang}/blog` : `/${lang}/login`} className="btn-primary">
      {label}
    </Link>
  );
}

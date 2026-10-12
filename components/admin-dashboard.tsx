"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { getDict } from "@/lib/i18n";
import type { Lang } from "@/lib/posts";
import {
  authFetch,
  getAuth,
  getServerAuth,
  subscribeAuth,
} from "@/lib/auth-client";

interface AdminComment {
  id: string;
  postLang: string;
  postSlug: string;
  content: string;
  status: number;
  createdAt: string;
  author: string;
}

interface AdminUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: string;
  status: number;
  createdAt: string;
  commentCount: number;
}

/** 空订阅器：配合 useSyncExternalStore 的 server/client 快照差异判断是否已 hydration */
const noopSubscribe = () => () => {};

function fmt(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 站务管理台：数据看板 + 评论/用户管理（数据来自 /api/v1/admin） */
export default function AdminDashboard({ lang }: { lang: Lang }) {
  const t = getDict(lang).admin;
  const router = useRouter();
  const user = useSyncExternalStore(subscribeAuth, getAuth, getServerAuth);
  const isAdmin = user?.role === "ADMIN";

  // 认证信息只存在 localStorage 里：SSR / hydration 阶段的快照恒为 null。
  // 必须等真正落到客户端再判断权限，否则每次刷新管理台都会被误判成未登录而踢回首页。
  // 用 useSyncExternalStore 的 server/client 快照差异来判断，避免 setState-in-effect。
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  // 未登录 / 非 ADMIN：直接回首页，不再渲染「请先接入身份认证」空白守卫页。
  // 这里用 getAuth() 直接读客户端权威值（localStorage 模块缓存），
  // 不依赖 useSyncExternalStore 的 auth 快照 —— 它在 hydration 阶段恒为 null，会造成误判。
  useEffect(() => {
    if (!hydrated) return;
    if (getAuth()?.role !== "ADMIN") router.replace(`/${lang}`);
  }, [hydrated, isAdmin, router, lang]);

  const [tab, setTab] = useState<"comments" | "users">("comments");
  const [stats, setStats] = useState<{
    users: number;
    posts: number;
    comments: number;
    likes: number;
    views: number;
  } | null>(null);
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [commentTotal, setCommentTotal] = useState(0);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadStats = useCallback(async () => {
    const res = await authFetch("/api/v1/admin/stats");
    if (res?.ok) setStats(await res.json());
  }, []);

  /** 错误码 → 本地化文案。res 为 null 表示 authFetch 刷新会话也失败了（本地登录态已清） */
  const showError = useCallback(
    (code: string | undefined, res: Response | null) => {
      const key = code ?? (res === null ? "SESSION_EXPIRED" : "SERVER_ERROR");
      setError(t.errors[key] ?? t.errors.SERVER_ERROR);
    },
    [t],
  );

  const loadComments = useCallback(async () => {
    setBusy(true);
    try {
      const res = await authFetch("/api/v1/admin/comments?page=1");
      const data = (await res?.json().catch(() => ({}))) ?? {};
      if (res?.ok) {
        setComments(data.items);
        setCommentTotal(data.total);
        setError(null);
      } else {
        showError(data.code, res);
      }
    } finally {
      setBusy(false);
    }
  }, [showError]);

  const loadUsers = useCallback(async () => {
    setBusy(true);
    try {
      const res = await authFetch("/api/v1/admin/users?page=1");
      const data = (await res?.json().catch(() => ({}))) ?? {};
      if (res?.ok) {
        setUsers(data.items);
        setError(null);
      } else {
        showError(data.code, res);
      }
    } finally {
      setBusy(false);
    }
  }, [showError]);

  useEffect(() => {
    if (!isAdmin) return;
    void (async () => {
      await Promise.all([loadStats(), loadComments(), loadUsers()]);
    })();
  }, [isAdmin, loadStats, loadComments, loadUsers]);

  const patchComment = async (id: string, status: 0 | 1) => {
    const res = await authFetch(`/api/v1/admin/comments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res?.ok) {
      setComments((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
      void loadStats();
    }
  };

  const destroyComment = async (id: string) => {
    if (!window.confirm(t.confirmDestroy)) return;
    const res = await authFetch(`/api/v1/admin/comments/${id}`, { method: "DELETE" });
    if (res?.ok) {
      setComments((prev) => prev.filter((c) => c.id !== id));
      setCommentTotal((n) => Math.max(0, n - 1));
      void loadStats();
    }
  };

  const patchUser = async (id: string, status: 0 | 1) => {
    const res = await authFetch(`/api/v1/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = (await res?.json().catch(() => ({}))) ?? {};
    if (res?.ok) {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status } : u)));
      void loadStats();
    } else if (data.code === "SELF_BAN") {
      setError(t.selfBan);
    }
  };

  const destroyUser = async (id: string) => {
    if (!window.confirm(t.confirmDeleteUser)) return;
    const res = await authFetch(`/api/v1/admin/users/${id}`, { method: "DELETE" });
    const data = (await res?.json().catch(() => ({}))) ?? {};
    if (res?.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setError(null);
      void loadStats();
    } else if (data.code === "SELF_DELETE") {
      setError(t.selfDelete);
    } else if (data.code === "HAS_POSTS") {
      setError(t.hasPosts);
    } else {
      showError(data.code, res);
    }
  };

  // ── 守卫 ──
  // 未 hydration（SSR）或权限不足时都不渲染内容；
  // 权限不足的情况由上面的 effect 重定向回首页（选项 A）。
  if (!hydrated || !isAdmin) return null;

  return (
    <div className="nx-admin">
      <div className="section-label">{t.subtitle}</div>
      <h1 className="admin-title">{t.title}</h1>

      {stats && (
        <div className="admin-stats">
              {[
                { k: t.stats.users, v: stats.users },
                { k: t.stats.posts, v: stats.posts },
                { k: t.stats.comments, v: stats.comments },
                { k: t.stats.likes, v: stats.likes },
                { k: t.stats.views, v: stats.views },
              ].map((s) => (
            <div className="admin-stat" key={s.k}>
              <span className="admin-stat-val">{s.v.toLocaleString()}</span>
              <span className="admin-stat-key">{s.k}</span>
            </div>
          ))}
        </div>
      )}

      <div className="admin-tabs">
        <button
          type="button"
          className={tab === "comments" ? "active" : ""}
          onClick={() => setTab("comments")}
        >
          {t.tabs.comments}
        </button>
        <button
          type="button"
          className={tab === "users" ? "active" : ""}
          onClick={() => setTab("users")}
        >
          {t.tabs.users}
        </button>
        <button type="button" className="admin-refresh" onClick={() => { void loadStats(); void loadComments(); void loadUsers(); }}>
          ⟳ {t.actions.refresh}
        </button>
      </div>

      {error && <p className="auth-error">{error}</p>}

      {tab === "comments" && (
        <div className="admin-table">
          <div className="admin-row admin-row-head">
            <span>{t.table.author}</span>
            <span>{t.table.post}</span>
            <span>{t.table.status}</span>
            <span>{t.table.time}</span>
            <span>{t.table.actions}</span>
          </div>
          {comments.map((c) => (
            <div className="admin-row" key={c.id}>
              <span className="admin-author">
                {c.author}
                <em title={c.content}>{c.content}</em>
              </span>
              <span>
                <Link href={`/${c.postLang}/blog/${c.postSlug}`} className="admin-post">
                  {c.postSlug}
                </Link>
              </span>
              <span>
                <span className={`status-badge ${c.status === 1 ? "ok" : "warn"}`}>
                  {c.status === 1 ? t.status.visible : t.status.hidden}
                </span>
              </span>
              <span className="admin-time">{fmt(c.createdAt)}</span>
              <span className="admin-actions">
                {c.status === 1 ? (
                  <button type="button" onClick={() => void patchComment(c.id, 0)}>{t.actions.hide}</button>
                ) : (
                  <button type="button" onClick={() => void patchComment(c.id, 1)}>{t.actions.restore}</button>
                )}
                <button type="button" className="danger" onClick={() => void destroyComment(c.id)}>
                  {t.actions.destroy}
                </button>
              </span>
            </div>
          ))}
          {comments.length === 0 && !busy && <p className="admin-empty">{t.empty}</p>}
          <p className="admin-total">{t.tabs.comments} · {commentTotal}</p>
        </div>
      )}

      {tab === "users" && (
        <div className="admin-table admin-table-users">
          <div className="admin-row admin-row-head">
            <span>{t.table.user}</span>
            <span>{t.table.email}</span>
            <span>{t.table.role}</span>
            <span>{t.table.comments}</span>
            <span>{t.table.status}</span>
            <span>{t.table.actions}</span>
          </div>
          {users.map((u) => (
            <div className="admin-row" key={u.id}>
              <span className="admin-author">
                {u.displayName}
                <em>@{u.username}</em>
              </span>
              <span className="admin-time">{u.email}</span>
              <span>
                <span className={`status-badge ${u.role === "ADMIN" ? "gold" : ""}`}>{u.role}</span>
              </span>
              <span className="admin-time">{u.commentCount}</span>
              <span>
                <span className={`status-badge ${u.status === 1 ? "ok" : "danger-badge"}`}>
                  {u.status === 1 ? t.status.active : t.status.banned}
                </span>
              </span>
              <span className="admin-actions">
                {u.id !== user?.id && (
                  <>
                    {u.status === 1 ? (
                      <button type="button" className="danger" onClick={() => void patchUser(u.id, 0)}>
                        {t.actions.ban}
                      </button>
                    ) : (
                      <button type="button" onClick={() => void patchUser(u.id, 1)}>
                        {t.actions.unban}
                      </button>
                    )}
                    <button type="button" className="danger" onClick={() => void destroyUser(u.id)}>
                      {t.actions.delete}
                    </button>
                  </>
                )}
              </span>
            </div>
          ))}
          {users.length === 0 && !busy && <p className="admin-empty">{t.empty}</p>}
        </div>
      )}
    </div>
  );
}

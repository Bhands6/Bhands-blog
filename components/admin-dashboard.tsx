"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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

function fmt(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 站务管理台：数据看板 + 评论/用户管理（数据来自 /api/v1/admin） */
export default function AdminDashboard({ lang }: { lang: Lang }) {
  const t = getDict(lang).admin;
  const nav = getDict(lang);
  const user = useSyncExternalStore(subscribeAuth, getAuth, getServerAuth);
  const isAdmin = user?.role === "ADMIN";

  const [tab, setTab] = useState<"comments" | "users">("comments");
  const [stats, setStats] = useState<{ users: number; comments: number; likes: number; views: number } | null>(null);
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [commentTotal, setCommentTotal] = useState(0);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadStats = useCallback(async () => {
    const res = await authFetch("/api/v1/admin/stats");
    if (res?.ok) setStats(await res.json());
  }, []);

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
        setError(data.code ?? "FORBIDDEN");
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setBusy(true);
    try {
      const res = await authFetch("/api/v1/admin/users?page=1");
      const data = (await res?.json().catch(() => ({}))) ?? {};
      if (res?.ok) {
        setUsers(data.items);
        setError(null);
      } else {
        setError(data.code ?? "FORBIDDEN");
      }
    } finally {
      setBusy(false);
    }
  }, []);

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

  // ── 守卫 ──
  if (!user) {
    return (
      <div className="admin-guard">
        <p>{t.needLogin}</p>
        <Link href={`/${lang}/login`} className="btn-primary">
          {nav.nexus.login}
        </Link>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="admin-guard">
        <p>{t.needAdmin}</p>
      </div>
    );
  }

  return (
    <div className="nx-admin">
      <div className="section-label">{t.subtitle}</div>
      <h1 className="admin-title">{t.title}</h1>

      {stats && (
        <div className="admin-stats">
          {[
            { k: t.stats.users, v: stats.users },
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
        <div className="admin-table">
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
                {u.id !== user?.id &&
                  (u.status === 1 ? (
                    <button type="button" className="danger" onClick={() => void patchUser(u.id, 0)}>
                      {t.actions.ban}
                    </button>
                  ) : (
                    <button type="button" onClick={() => void patchUser(u.id, 1)}>
                      {t.actions.unban}
                    </button>
                  ))}
              </span>
            </div>
          ))}
          {users.length === 0 && !busy && <p className="admin-empty">{t.empty}</p>}
        </div>
      )}
    </div>
  );
}

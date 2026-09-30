"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { getDict } from "@/lib/i18n";
import type { Lang } from "@/lib/posts";
import { authFetch, getAuth, getServerAuth, subscribeAuth, type AuthUser } from "@/lib/auth-client";

type Labels = ReturnType<typeof getDict>["comments"];

interface CommentItem {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; displayName: string; avatarUrl: string | null; role: string };
  replies: CommentItem[];
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CommentCard({
  item,
  labels,
  user,
  onReply,
  onDelete,
  isReply = false,
}: {
  item: CommentItem;
  labels: Labels;
  user: AuthUser | null;
  onReply: (item: CommentItem) => void;
  onDelete: (item: CommentItem) => void;
  isReply?: boolean;
}) {
  const canDelete = user && (user.id === item.user.id || user.role === "ADMIN");
  return (
    <div className={`comment-card ${isReply ? "is-reply" : ""}`}>
      <div className="comment-avatar" aria-hidden="true">
        {item.user.displayName.slice(0, 1).toUpperCase()}
      </div>
      <div className="comment-body">
        <div className="comment-meta">
          <span className="comment-name">
            {item.user.displayName}
            {item.user.role === "ADMIN" && <span className="comment-badge">ADMIN</span>}
          </span>
          <span className="comment-time">{formatTime(item.createdAt)}</span>
          <span className="comment-actions">
            {!isReply && (
              <button type="button" onClick={() => onReply(item)}>
                {labels.reply}
              </button>
            )}
            {canDelete && (
              <button type="button" className="danger" onClick={() => onDelete(item)}>
                {labels.delete}
              </button>
            )}
          </span>
        </div>
        <p className="comment-content">{item.content}</p>
        {item.replies.length > 0 && (
          <div className="comment-replies">
            {item.replies.map((r) => (
              <CommentCard
                key={r.id}
                item={r}
                labels={labels}
                user={user}
                onReply={onReply}
                onDelete={onDelete}
                isReply
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** 评论通讯区（对接 /api/v1/posts/{lang}/{slug}/comments） */
export default function Comments({
  title,
  lang,
  slug,
  loginHref,
  loginLabel,
}: {
  title: string;
  lang: Lang;
  slug: string;
  loginHref: string;
  loginLabel: string;
}) {
  const labels = getDict(lang).comments;
  const user = useSyncExternalStore(subscribeAuth, getAuth, getServerAuth);
  const [items, setItems] = useState<CommentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      setLoadError(false);
      try {
        const res = await fetch(`/api/v1/posts/${lang}/${slug}/comments?page=${p}`);
        if (!res.ok) throw new Error("load failed");
        const data = (await res.json()) as { items: CommentItem[]; total: number };
        setItems(data.items);
        setTotal(data.total);
        setPage(p);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    },
    [lang, slug],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 列表数据只能在挂载后拉取
    void load(1);
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch(`/api/v1/posts/${lang}/${slug}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), parentId: replyTo?.id }),
      });
      const data = (await res?.json().catch(() => ({}))) ?? {};
      if (!res || !res.ok) {
        setError(
          data.code === "RATE_LIMITED"
            ? labels.rateLimited
            : (data.code && labels.loadError) || labels.loadError,
        );
        return;
      }
      setContent("");
      setReplyTo(null);
      await load(1);
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (item: CommentItem) => {
    if (!window.confirm(labels.confirmDelete)) return;
    const res = await authFetch(`/api/v1/comments/${item.id}`, { method: "DELETE" });
    if (res && res.ok) await load(page);
  };

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <section className="nx-comments">
      <div className="comments-head">
        <h2 className="comments-title">{title}</h2>
        <span className="comments-count">{labels.subtitle(total)}</span>
      </div>

      {loadError && <p className="comment-login">{labels.loadError}</p>}
      {!loadError && !loading && items.length === 0 && (
        <p className="comments-empty">{labels.empty}</p>
      )}

      <div className="comments-list">
        {items.map((item) => (
          <CommentCard
            key={item.id}
            item={item}
            labels={labels}
            user={user}
            onReply={setReplyTo}
            onDelete={remove}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="comments-pager">
          <button type="button" className="btn-ghost" disabled={page <= 1} onClick={() => void load(page - 1)}>
            {labels.prev}
          </button>
          <span className="comments-page-num">{page} / {totalPages}</span>
          <button type="button" className="btn-ghost" disabled={page >= totalPages} onClick={() => void load(page + 1)}>
            {labels.next}
          </button>
        </div>
      )}

      {user ? (
        <form className="comment-form" onSubmit={submit}>
          {replyTo && (
            <p className="reply-banner">
              {labels.replyTo(replyTo.user.displayName)}
              <button type="button" onClick={() => setReplyTo(null)}>
                {labels.cancelReply}
              </button>
            </p>
          )}
          {error && <p className="auth-error">{error}</p>}
          <textarea
            className="comment-input"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={labels.placeholder}
            maxLength={1000}
            required
            disabled={submitting}
          />
          <div className="comment-form-actions">
            <span className="comment-char">{content.length} / 1000</span>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? labels.submitting : labels.submit}
            </button>
          </div>
        </form>
      ) : (
        <p className="comment-login">
          {labels.loginRequired}
          <Link href={loginHref} className="btn-primary">
            {loginLabel}
          </Link>
        </p>
      )}
    </section>
  );
}

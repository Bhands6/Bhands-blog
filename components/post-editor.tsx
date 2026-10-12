"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { getDict, type Dict } from "@/lib/i18n";
import type { Lang } from "@/lib/posts";
import { authFetch, getAuth, getServerAuth, subscribeAuth } from "@/lib/auth-client";

type WriteLabels = Dict["write"];
type CategoryKey = "tech" | "life" | "essay";

/** 空订阅器：配合 useSyncExternalStore 的 server/client 快照差异判断是否已 hydration */
const noopSubscribe = () => () => {};

interface PostData {
  id: string;
  lang: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  content: string;
}

/** 在线写作编辑器：新建 / 编辑（?id=）在线文章，仅 ADMIN 可用 */
export default function PostEditor({
  lang,
  editId,
  categoryNames,
}: {
  lang: Lang;
  editId?: string;
  categoryNames: Record<CategoryKey, string>;
}) {
  const router = useRouter();
  const t = getDict(lang);
  const w: WriteLabels = t.write;
  const user = useSyncExternalStore(subscribeAuth, getAuth, getServerAuth);
  const isAdmin = user?.role === "ADMIN";

  // 认证信息只存在 localStorage 里：SSR / hydration 阶段的快照恒为 null。
  // 必须等真正落到客户端再判断权限，否则每次刷新写作页都会被误判成未登录而踢回首页。
  // 用 useSyncExternalStore 的 server/client 快照差异来判断，避免 setState-in-effect。
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  // 未登录 / 非 ADMIN：直接回首页，不再渲染「请先接入身份认证」空白守卫页。
  // 这里用 getAuth() 直接读客户端权威值（localStorage 模块缓存），
  // 不依赖 useSyncExternalStore 的 auth 快照 —— 它在 hydration 阶段恒为 null，会造成误判。
  useEffect(() => {
    if (!hydrated) return;
    if (getAuth()?.role !== "ADMIN") router.replace(`/${lang}`);
  }, [hydrated, isAdmin, router, lang]);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [postLang, setPostLang] = useState<Lang>(lang);
  const [category, setCategory] = useState<CategoryKey>("tech");
  const [tags, setTags] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(editId));
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedId = useRef<string | null>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showWriteError = useCallback(
    (code: string | undefined, fallback: string) => {
      setError((code && w.errors[code]) || fallback || w.errors.SERVER_ERROR);
    },
    [w],
  );

  /**
   * 在光标处插入 Markdown 片段；插入后把光标移到片段末尾。
   * 用函数式 setContent：直接读闭包里的 content 会在「上传期间用户又敲了字」
   * 或「一次插入多条」时把新内容覆盖掉。
   */
  const insertAtCursor = useCallback((text: string) => {
    const ta = contentRef.current;
    const selStart = ta?.selectionStart ?? null;
    const selEnd = ta?.selectionEnd ?? null;
    let caret = 0;
    setContent((prev) => {
      const start = selStart ?? prev.length;
      const end = selEnd ?? prev.length;
      const before = prev.slice(0, start);
      const after = prev.slice(end);
      // 光标前不是行首就补一个换行，避免图片语法粘在上一段文字后面
      const lead = before === "" || before.endsWith("\n") ? "" : "\n";
      const snippet = `${lead}${text}\n`;
      caret = before.length + snippet.length;
      return before + snippet + after;
    });
    // 等 React 把新值写回 DOM 再恢复光标，否则会被重置到末尾
    requestAnimationFrame(() => {
      const el = contentRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }, []);

  /** 上传图片（文件选择 / 粘贴 / 拖拽共用）：全部传完后一次性插入 Markdown */
  const uploadImages = useCallback(
    async (files: File[]) => {
      const imgs = files.filter((f) => f.type.startsWith("image/"));
      if (imgs.length === 0 || uploading) return;
      setUploading(true);
      setError(null);
      try {
        const snippets: string[] = [];
        for (const file of imgs) {
          const fd = new FormData();
          fd.append("file", file);
          // 不手动设 Content-Type：交给浏览器补 multipart boundary
          const res = await authFetch("/api/v1/media", { method: "POST", body: fd });
          const data = (await res?.json().catch(() => ({}))) as {
            media?: { url: string };
            code?: string;
          };
          if (res?.ok && data.media?.url) {
            const alt = file.name.replace(/\.[^.]+$/, "") || "image";
            snippets.push(`![${alt}](${data.media.url})`);
          } else {
            showWriteError(data.code, "");
            break;
          }
        }
        // 一次性插入，保证多张图片的先后顺序且互不覆盖
        if (snippets.length > 0) insertAtCursor(snippets.join("\n"));
      } finally {
        setUploading(false);
      }
    },
    [insertAtCursor, showWriteError, uploading],
  );

  /** 粘贴板里带图片（截图 Ctrl+V）时直接上传，不走纯文本粘贴 */
  const onContentPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData?.files ?? []);
    if (!files.some((f) => f.type.startsWith("image/"))) return;
    e.preventDefault();
    void uploadImages(files);
  };

  const onDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setDragging(false);
    if (busy || uploading) return;
    void uploadImages(Array.from(e.dataTransfer.files));
  };

  // 编辑模式：回填文章
  useEffect(() => {
    if (!editId || !user || loadedId.current === editId) return;
    loadedId.current = editId;
    (async () => {
      const res = await authFetch(`/api/v1/posts/manage/${editId}`);
      if (!res?.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { post: PostData };
      setTitle(data.post.title);
      setSlug(data.post.slug);
      setPostLang(data.post.lang === "en" ? "en" : "zh");
      setCategory(
        data.post.category === "life" || data.post.category === "essay"
          ? data.post.category
          : "tech",
      );
      setTags(data.post.tags.join(", "));
      setSummary(data.post.summary);
      setContent(data.post.content);
      setLoading(false);
    })();
  }, [editId, user]);

  // 预览：500ms 防抖调渲染接口
  useEffect(() => {
    if (!preview) return;
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      const res = await authFetch("/api/v1/posts/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res?.ok) {
        const data = (await res.json()) as { html: string };
        setPreviewHtml(data.html);
      } else {
        setPreviewHtml("");
      }
    }, 500);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [content, preview]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);

    const payload = {
      title: title.trim(),
      lang: postLang,
      summary: summary.trim(),
      category,
      tags: tags
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8),
      content,
      ...(slug.trim() ? { slug: slug.trim() } : {}),
    };
    const res = await authFetch(editId ? `/api/v1/posts/manage/${editId}` : "/api/v1/posts", {
      method: editId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res?.json().catch(() => ({}))) as {
      post?: { slug: string; lang: Lang };
      code?: string;
      error?: string;
    };
    if (!res?.ok || !data) {
      showWriteError(data?.code, data?.error ?? "");
      setBusy(false);
      return;
    }
    const target = data.post ?? { slug: payload.slug, lang: postLang };
    router.push(`/${target.lang}/blog/${target.slug}`);
    router.refresh();
  };

  const remove = async () => {
    if (!editId || busy || !window.confirm(w.confirmDelete)) return;
    setBusy(true);
    const res = await authFetch(`/api/v1/posts/manage/${editId}`, { method: "DELETE" });
    if (res?.ok) {
      router.push(`/${lang}/blog`);
      router.refresh();
    } else {
      setBusy(false);
    }
  };

  // ── 守卫 ──
  // 未 hydration（SSR）或权限不足时都不渲染内容；
  // 权限不足的情况由上面的 effect 重定向回首页（选项 A）。
  if (!hydrated || !isAdmin) return null;
  if (loading) {
    return (
      <div className="write-gate">
        <p>{w.busy}</p>
      </div>
    );
  }
  if (notFound) {
    return (
      <div className="write-gate">
        <p>{w.errors.INVALID_PARAMS}</p>
      </div>
    );
  }

  const selectCls = "write-select";

  return (
    <form className="write-form" onSubmit={submit}>
      <div className="input-group">
        <label className="input-label" htmlFor="nx-w-title">
          <span className="dot" />
          {w.fields.title}
        </label>
        <div className="input-wrapper">
          <input
            id="nx-w-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={w.fields.titlePh}
            maxLength={200}
            required
            disabled={busy}
          />
        </div>
      </div>

      <div className="write-row">
        <div className="input-group write-grow">
          <label className="input-label" htmlFor="nx-w-slug">
            <span className="dot" />
            {w.fields.slug}
          </label>
          <div className="input-wrapper">
            <input
              id="nx-w-slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={w.fields.slugPh}
              maxLength={200}
              pattern="[^\s/?#]+"
              disabled={busy}
            />
          </div>
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="nx-w-lang">
            <span className="dot" />
            {w.fields.lang}
          </label>
          <select
            id="nx-w-lang"
            className={selectCls}
            value={postLang}
            onChange={(e) => setPostLang(e.target.value as Lang)}
            disabled={busy}
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="nx-w-cat">
            <span className="dot" />
            {w.fields.category}
          </label>
          <select
            id="nx-w-cat"
            className={selectCls}
            value={category}
            onChange={(e) => setCategory(e.target.value as CategoryKey)}
            disabled={busy}
          >
            <option value="tech">{categoryNames.tech}</option>
            <option value="life">{categoryNames.life}</option>
            <option value="essay">{categoryNames.essay}</option>
          </select>
        </div>
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="nx-w-tags">
          <span className="dot" />
          {w.fields.tags}
        </label>
        <div className="input-wrapper">
          <input
            id="nx-w-tags"
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder={w.fields.tagsPh}
            disabled={busy}
          />
        </div>
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="nx-w-summary">
          <span className="dot" />
          {w.fields.summary}
        </label>
        <div className="input-wrapper">
          <textarea
            id="nx-w-summary"
            className="write-area write-area-short"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder={w.fields.summaryPh}
            maxLength={500}
            rows={2}
            disabled={busy}
          />
        </div>
      </div>

      <div className="input-group">
        <div className="write-content-head">
          <label className="input-label" htmlFor="nx-w-content">
            <span className="dot" />
            {w.fields.content}
          </label>
          <div className="write-head-actions">
            <button
              type="button"
              className="write-upload"
              onClick={() => fileRef.current?.click()}
              disabled={busy || uploading}
              title={w.dropHint}
            >
              {uploading ? w.uploading : `＋ ${w.insertImage}`}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
              multiple
              hidden
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = ""; // 允许连续选择同一个文件
                void uploadImages(files);
              }}
            />
            <button
              type="button"
              className={`write-toggle ${preview ? "active" : ""}`}
              onClick={() => setPreview((v) => !v)}
            >
              {preview ? w.editing : w.preview}
            </button>
          </div>
        </div>
        <p className="write-hint">{w.dropHint}</p>
        <div className="input-wrapper">
          <textarea
            id="nx-w-content"
            ref={contentRef}
            className={`write-area write-area-code ${dragging ? "write-area-drag" : ""}`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onPaste={onContentPaste}
            onDragOver={(e) => {
              if (busy || uploading) return;
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            required
            rows={18}
            disabled={busy}
          />
        </div>
        {preview && (
          <div
            className="article-body write-preview"
            // 预览 HTML 来自站内同一渲染管线（仅 ADMIN 可触发）
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        )}
      </div>

      {error && <p className="auth-error">{error}</p>}

      <div className="write-actions">
        <button type="submit" className="btn-submit" disabled={busy}>
          <span className="btn-text">{busy ? w.busy : editId ? w.update : w.publish}</span>
        </button>
        {editId && (
          <button type="button" className="write-delete" onClick={() => void remove()} disabled={busy}>
            {w.delete}
          </button>
        )}
      </div>
    </form>
  );
}

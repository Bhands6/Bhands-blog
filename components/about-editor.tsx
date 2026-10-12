"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { authFetch, getAuth, getServerAuth, subscribeAuth } from "@/lib/auth-client";
import { getDict } from "@/lib/i18n";
import type { Lang } from "@/lib/posts";
import type { AboutContent, AboutFact } from "@/lib/site-content";

/** 空订阅器：配合 useSyncExternalStore 的 server/client 快照差异判断是否已 hydration */
const noopSubscribe = () => () => {};

/**
 * 关于页的「编辑本页」入口。
 *
 * 认证信息存在 localStorage，SSR / hydration 阶段 getServerAuth() 恒为 null，
 * 所以非管理员在服务端与客户端都不会渲染出这个按钮，不会闪。
 */
export default function AboutEditor({ lang, initial }: { lang: Lang; initial: AboutContent }) {
  const router = useRouter();
  const t = getDict(lang);
  const a = t.about;
  const user = useSyncExternalStore(subscribeAuth, getAuth, getServerAuth);
  // 用 useSyncExternalStore 的 server/client 快照差异判断是否已 hydration，
  // 避免 setState-in-effect（React 19 的 react-hooks/set-state-in-effect 会拦）
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paragraphs, setParagraphs] = useState<string[]>(initial.paragraphs);
  const [facts, setFacts] = useState<AboutFact[]>(initial.facts);

  const close = useCallback(() => {
    if (busy) return;
    setOpen(false);
  }, [busy]);

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  // 弹窗打开时锁住页面滚动
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const startEdit = () => {
    setParagraphs(initial.paragraphs);
    setFacts(initial.facts);
    setError(null);
    setOpen(true);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch("/api/v1/site-content/about", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, paragraphs, facts }),
      });
      const data = (await res?.json().catch(() => ({}))) as { code?: string } | undefined;
      if (res?.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(a.errors[data?.code ?? ""] ?? data?.code ?? a.errors.SERVER_ERROR);
      }
    } finally {
      setBusy(false);
    }
  };

  if (!hydrated || user?.role !== "ADMIN") return null;

  return (
    <>
      <button type="button" className="about-edit-btn" onClick={startEdit}>
        <span aria-hidden="true">✎</span>
        {a.edit}
      </button>

      {/* 弹窗挂到 body 下：.page-content 有 z-index:1，会把它内部的 fixed 元素
          一起作用域化，那样固定导航栏（z-1000）就会压在弹窗上面 */}
      {open &&
        createPortal(
          <div
            className="edit-overlay"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
          <div className="edit-panel" role="dialog" aria-modal="true" aria-label={a.editTitle}>
            <header className="edit-head">
              <span className="edit-head-title">{a.editTitle}</span>
              <button type="button" className="edit-icon-btn" onClick={close} aria-label={a.cancel}>
                ✕
              </button>
            </header>

            <div className="edit-body">
              <section className="edit-sec">
                <div className="edit-sec-head">
                  <span className="edit-sec-label">{a.paragraphsLabel}</span>
                  <span className="edit-sec-hint">{a.paragraphsHint}</span>
                </div>
                {paragraphs.map((p, i) => (
                  <div className="edit-row" key={`p-${i}`}>
                    <textarea
                      className="edit-textarea"
                      value={p}
                      rows={2}
                      maxLength={500}
                      disabled={busy}
                      onChange={(e) =>
                        setParagraphs((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
                      }
                    />
                    <button
                      type="button"
                      className="edit-icon-btn"
                      title={a.removeRow}
                      aria-label={a.removeRow}
                      disabled={busy}
                      onClick={() => setParagraphs((prev) => prev.filter((_, j) => j !== i))}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="edit-add"
                  disabled={busy}
                  onClick={() => setParagraphs((prev) => [...prev, ""])}
                >
                  ＋ {a.addParagraph}
                </button>
              </section>

              <section className="edit-sec">
                <div className="edit-sec-head">
                  <span className="edit-sec-label">{a.factsLabel}</span>
                  <span className="edit-sec-hint">{a.factsHint}</span>
                </div>
                {facts.map((f, i) => (
                  <div className="edit-row" key={`f-${i}`}>
                    <input
                      className="edit-input edit-input-k"
                      value={f.k}
                      maxLength={40}
                      disabled={busy}
                      aria-label={a.factsLabel}
                      onChange={(e) =>
                        setFacts((prev) => prev.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))
                      }
                    />
                    <input
                      className="edit-input"
                      value={f.v}
                      maxLength={300}
                      disabled={busy}
                      aria-label={a.factsHint}
                      onChange={(e) =>
                        setFacts((prev) => prev.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))
                      }
                    />
                    <button
                      type="button"
                      className="edit-icon-btn"
                      title={a.removeRow}
                      aria-label={a.removeRow}
                      disabled={busy}
                      onClick={() => setFacts((prev) => prev.filter((_, j) => j !== i))}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="edit-add"
                  disabled={busy}
                  onClick={() => setFacts((prev) => [...prev, { k: "", v: "" }])}
                >
                  ＋ {a.addFact}
                </button>
              </section>

              {error && <p className="edit-error">{error}</p>}
            </div>

            <footer className="edit-foot">
              <button type="button" className="btn-ghost" onClick={close} disabled={busy}>
                {a.cancel}
              </button>
              <button type="button" className="btn-primary" onClick={() => void save()} disabled={busy}>
                {busy ? a.saving : a.save}
              </button>
            </footer>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

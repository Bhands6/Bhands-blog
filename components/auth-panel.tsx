"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Dict } from "@/lib/i18n";
import { setAuthUser, type AuthUser } from "@/lib/auth-client";

type AuthLabels = Dict["auth"]["card"];

const scorePassword = (pw: string) => {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 3);
};

const strengthCls = ["weak", "fair", "good", "strong"] as const;

/** 登录 / 注册认证卡片（对接 /api/v1/auth 真实接口） */
export default function AuthPanel({ labels, lang }: { labels: AuthLabels; lang: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strength, setStrength] = useState(-1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const switchTab = (next: "login" | "register") => {
    if (next === tab || busy) return;
    setTab(next);
    setError(null);
  };

  const showError = (code: string | undefined, fallback: string) => {
    setError(
      (code && labels.errors[code]) || fallback || labels.errors.SERVER_ERROR,
    );
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const form = new FormData(e.currentTarget);
    setError(null);
    setBusy(true);
    setDone(false);

    const endpoint = tab === "login" ? "/api/v1/auth/login" : "/api/v1/auth/register";
    const payload =
      tab === "login"
        ? { account: String(form.get("account") ?? ""), password: String(form.get("password") ?? "") }
        : {
            username: String(form.get("username") ?? ""),
            email: String(form.get("email") ?? ""),
            password: String(form.get("password") ?? ""),
          };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        user?: AuthUser;
        code?: string;
        error?: string;
      };
      if (!res.ok || !data.user) {
        showError(data.code, data.error ?? "");
        setBusy(false);
        return;
      }
      // 会话凭证在 httpOnly Cookie 里由服务端下发，前端只记录用户资料
      setAuthUser(data.user);
      setDone(true);
      timers.current.push(
        setTimeout(() => {
          router.push(`/${lang}`);
          router.refresh();
        }, 900),
      );
    } catch {
      showError("SERVER_ERROR", "");
      setBusy(false);
    }
  };

  const btnText = tab === "login" ? labels.login : labels.register;
  const btnLabel = done ? btnText.done : busy ? btnText.busy : btnText.submit;

  return (
    <div className="auth-card">
      <div className="auth-card-inner">
        <div className="corner tl" />
        <div className="corner tr" />
        <div className="corner bl" />
        <div className="corner br" />
        <div className="card-particles">
          {Array.from({ length: 6 }, (_, i) => (
            <div className="particle" key={i} />
          ))}
        </div>

        <div className="auth-header">
          <div className="auth-header-icon">
            <div className="ring" />
            <div className="ring" />
            <div className="ring" />
            <div className="core" />
          </div>
          <h2>{tab === "login" ? labels.title : labels.regTitle}</h2>
          <p>{tab === "login" ? labels.subtitle : labels.regSubtitle}</p>
        </div>

        <div className="auth-tabs">
          <div className={`tab-slider ${tab === "register" ? "right" : "left"}`} />
          <button
            type="button"
            className={`auth-tab ${tab === "login" ? "active" : ""}`}
            onClick={() => switchTab("login")}
          >
            {labels.tabLogin}
          </button>
          <button
            type="button"
            className={`auth-tab ${tab === "register" ? "active" : ""}`}
            onClick={() => switchTab("register")}
          >
            {labels.tabRegister}
          </button>
        </div>

        <div className="form-panels">
          {/* 登录 */}
          <div className={`form-panel ${tab === "login" ? "active" : ""}`} aria-hidden={tab !== "login"}>
            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label className="input-label" htmlFor="nx-login-id">
                  <span className="dot" />
                  {labels.login.idLabel}
                </label>
                <div className="input-wrapper">
                  <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <input id="nx-login-id" name="account" type="text" placeholder={labels.login.idPh} autoComplete="username" required disabled={busy} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="nx-login-pw">
                  <span className="dot" />
                  {labels.login.pwLabel}
                </label>
                <div className="input-wrapper">
                  <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input id="nx-login-pw" name="password" type="password" placeholder={labels.login.pwPh} autoComplete="current-password" required disabled={busy} />
                </div>
              </div>
              <div className="options-row">
                <label className="checkbox-wrap">
                  <input type="checkbox" defaultChecked />
                  <div className="checkbox-custom" />
                  <span className="checkbox-text">{labels.login.remember}</span>
                </label>
                <a href="#" className="forgot-link" onClick={(e) => e.preventDefault()}>
                  {labels.login.forgot}
                </a>
              </div>
              {error && <p className="auth-error">{error}</p>}
              <button type="submit" className={`btn-submit ${done ? "is-done" : ""}`} disabled={busy}>
                <span className="btn-text">{btnLabel}</span>
              </button>
              <div className="divider">
                <div className="divider-line" />
                <span className="divider-text">{labels.login.or}</span>
                <div className="divider-line" />
              </div>
              <div className="alt-auth">
                {labels.login.alts.map((alt) => (
                  <button type="button" className="btn-social" key={alt}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                    <span>{alt}</span>
                  </button>
                ))}
              </div>
              <p className="auth-footer-text">
                {labels.login.footerPre}{" "}
                <a onClick={() => switchTab("register")}>{labels.login.footerLink}</a>
              </p>
            </form>
          </div>

          {/* 注册 */}
          <div className={`form-panel ${tab === "register" ? "active" : ""}`} aria-hidden={tab !== "register"}>
            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label className="input-label" htmlFor="nx-reg-name">
                  <span className="dot" />
                  {labels.register.nameLabel}
                </label>
                <div className="input-wrapper">
                  <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <input id="nx-reg-name" name="username" type="text" placeholder={labels.register.namePh} autoComplete="nickname" required minLength={2} maxLength={20} disabled={busy} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="nx-reg-email">
                  <span className="dot" />
                  {labels.register.emailLabel}
                </label>
                <div className="input-wrapper">
                  <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  <input id="nx-reg-email" name="email" type="email" placeholder={labels.register.emailPh} autoComplete="email" required disabled={busy} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="nx-reg-pw">
                  <span className="dot" />
                  {labels.register.pwLabel}
                </label>
                <div className="input-wrapper">
                  <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    id="nx-reg-pw"
                    name="password"
                    type="password"
                    placeholder={labels.register.pwPh}
                    autoComplete="new-password"
                    required
                    minLength={6}
                    disabled={busy}
                    onInput={(e) => {
                      const pw = (e.target as HTMLInputElement).value;
                      setStrength(pw.length === 0 ? -1 : scorePassword(pw));
                    }}
                  />
                </div>
                <div className={`pw-strength ${strength >= 0 ? strengthCls[strength] : ""}`}>
                  <div className="bar" />
                  <div className="bar" />
                  <div className="bar" />
                  <div className="bar" />
                </div>
                <div className={`pw-strength-text ${strength >= 0 ? strengthCls[strength] : ""}`}>
                  {strength >= 0 ? labels.strengthPrefix + labels.strengthWords[strength] : ""}
                </div>
              </div>
              <div className="options-row" style={{ marginBottom: "1.5rem" }}>
                <label className="checkbox-wrap">
                  <input type="checkbox" required />
                  <div className="checkbox-custom" />
                  <span className="checkbox-text">{labels.register.agree}</span>
                </label>
              </div>
              {error && <p className="auth-error">{error}</p>}
              <button type="submit" className={`btn-submit ${done ? "is-done" : ""}`} disabled={busy}>
                <span className="btn-text">{btnLabel}</span>
              </button>
              <div className="divider">
                <div className="divider-line" />
                <span className="divider-text">{labels.register.or}</span>
                <div className="divider-line" />
              </div>
              <div className="alt-auth">
                <button type="button" className="btn-social" style={{ flex: 1 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h20" />
                  </svg>
                  <span>{labels.register.alt}</span>
                </button>
              </div>
              <p className="auth-footer-text">
                {labels.register.footerPre}{" "}
                <a onClick={() => switchTab("login")}>{labels.register.footerLink}</a>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}


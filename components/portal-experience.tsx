"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogoMark } from "./logo-mark";
import { site } from "@/lib/site";

export interface LandingLabels {
  tagline: string;
  intro: string;
  categoriesLabel: string;
  nextLabel: string;
  latestPost: string;
  enter: string;
  facts: { k: string; v: string }[];
}

export interface LandingCategory {
  key: string;
  label: string;
  href: string;
}

interface Props {
  lang: "zh" | "en";
  latest: { slug: string; title: string } | null;
  categories: LandingCategory[];
  aboutHref: string;
  labels: LandingLabels;
}

const FOCAL = 850;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function animateValue(setter: (v: number) => void, duration: number): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setter(easeInOutCubic(t));
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

/** 圆角矩形轮廓采样：4 个圆角各走 10 步，共约 44 个点（局部坐标，圆心在原点） */
function roundedRectPoints(w: number, h: number, r: number): [number, number][] {
  const pts: [number, number][] = [];
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  const corners: [number, number, number, number][] = [
    [w / 2 - radius, -h / 2 + radius, -Math.PI / 2, 0],
    [w / 2 - radius, h / 2 - radius, 0, Math.PI / 2],
    [-w / 2 + radius, h / 2 - radius, Math.PI / 2, Math.PI],
    [-w / 2 + radius, -h / 2 + radius, Math.PI, Math.PI * 1.5],
  ];
  for (const [cx, cy, a0, a1] of corners) {
    for (let i = 0; i <= 10; i++) {
      const a = a0 + ((a1 - a0) * i) / 10;
      pts.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]);
    }
  }
  return pts;
}

interface Star {
  x: number;
  y: number;
  r: number;
  a: number;
  tw: number;
  phase: number;
}

export default function PortalExperience({ lang, latest, categories, aboutHref, labels }: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLElement>(null);
  const starCanvasRef = useRef<HTMLCanvasElement>(null);
  const portalCanvasRef = useRef<HTMLCanvasElement>(null);
  const portalBtnRef = useRef<HTMLButtonElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  const [preloadVisible, setPreloadVisible] = useState(true);

  // 每帧渲染状态全部放 ref，避免重渲染
  const state = useRef({
    maskScale: 0,
    expansion: 0,
    rotX: 0,
    rotY: 0,
    targetX: 0,
    targetY: 0,
    pointerX: 0.5,
    pointerY: 0.5,
    parX: 0,
    parY: 0,
    busy: false,
    reduced: false,
    stars: [] as Star[],
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const s = state.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    s.reduced = reduced;

    const body = document.body;
    body.classList.add("intro");

    // ---------- 星空数据 ----------
    const makeStars = () => {
      const n = Math.min(340, Math.round((window.innerWidth * window.innerHeight) / 5200));
      s.stars = Array.from({ length: n }, () => ({
        x: Math.random(),
        y: Math.random(),
        r: 0.4 + Math.random() * 1.3,
        a: 0.15 + Math.random() * 0.75,
        tw: 0.4 + Math.random() * 1.6,
        phase: Math.random() * Math.PI * 2,
      }));
    };
    makeStars();

    // ---------- 画布尺寸 ----------
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const sizeCanvas = (c: HTMLCanvasElement | null) => {
      if (!c) return;
      c.width = window.innerWidth * dpr;
      c.height = window.innerHeight * dpr;
      c.style.width = `${window.innerWidth}px`;
      c.style.height = `${window.innerHeight}px`;
      const ctx = c.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    sizeCanvas(starCanvasRef.current);
    sizeCanvas(portalCanvasRef.current);
    const onResize = () => {
      sizeCanvas(starCanvasRef.current);
      sizeCanvas(portalCanvasRef.current);
      makeStars();
    };
    window.addEventListener("resize", onResize);

    // ---------- 指针倾斜 + 视差 ----------
    const onPointerMove = (e: PointerEvent) => {
      if (s.busy || reduced) return;
      s.targetY = (e.clientX / window.innerWidth - 0.5) * 37.4;
      s.targetX = (e.clientY / window.innerHeight - 0.5) * -33;
      s.pointerX = e.clientX / window.innerWidth;
      s.pointerY = e.clientY / window.innerHeight;
    };
    const onPointerLeave = () => {
      s.targetX = 0;
      s.targetY = 0;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);

    // ---------- 开场序列 ----------
    const startExperience = () => {
      body.classList.add("intro-ready");
      root.classList.add("mask-revealing");
      const reveal = animateValue((v) => (s.maskScale = v), reduced ? 10 : 1050);
      window.setTimeout(() => root.classList.add("content-revealing"), reduced ? 0 : 850);
      window.setTimeout(() => logoRef.current?.classList.add("is-gone"), reduced ? 0 : 2000);
      window.setTimeout(() => setPreloadVisible(false), reduced ? 0 : 1000);
      return reveal;
    };

    let reveal: Promise<void> | null = null;
    const visited = sessionStorage.getItem("bhands-visited");
    if (reduced || visited) {
      // 跳过或精简预载
      if (reduced) {
        setPreloadVisible(false);
        s.maskScale = 1;
        body.classList.add("intro-ready");
        root.classList.add("content-revealing");
      } else {
        reveal = startExperience();
      }
    } else {
      // 0 → 100 计数（约 1.7s）
      const t0 = performance.now();
      const DURATION = 1700;
      const count = (now: number) => {
        const t = Math.min(1, (now - t0) / DURATION);
        if (numRef.current) numRef.current.textContent = String(Math.round(easeInOutCubic(t) * 100));
        if (t < 1) requestAnimationFrame(count);
        else finishPreload();
      };
      const finishPreload = () => {
        sessionStorage.setItem("bhands-visited", "1");
        root.querySelector(".preloader-count")?.classList.add("is-leaving");
        logoRef.current?.classList.add("is-docked");
        document.querySelector(".preloader")?.classList.add("is-background");
        window.setTimeout(() => {
          reveal = startExperience();
        }, 250);
      };
      requestAnimationFrame(count);
    }

    // ---------- 渲染循环 ----------
    let raf = 0;
    let last = performance.now();
    const drawStarfield = (ctx: CanvasRenderingContext2D, time: number) => {
      const W = window.innerWidth;
      const H = window.innerHeight;
      ctx.clearRect(0, 0, W, H);
      // 微弱星云
      const blob = (bx: number, by: number, br: number, alpha: number) => {
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0, `rgba(255,255,255,${alpha})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(bx - br, by - br, br * 2, br * 2);
      };
      blob(W * (0.72 - s.parX * 0.02), H * 0.24, H * 0.5, 0.045);
      blob(W * (0.18 - s.parX * 0.01), H * 0.8, H * 0.42, 0.035);
      // 星星
      for (const star of s.stars) {
        const twinkle = 0.6 + 0.4 * Math.sin(time * 0.001 * star.tw + star.phase);
        const depth = star.r / 1.7;
        const x = (star.x * W - s.parX * 26 * depth + time * 0.0016 * depth) % W;
        const y = (star.y * H - s.parY * 18 * depth) % H;
        ctx.globalAlpha = star.a * twinkle;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc((x + W) % W, (y + H) % H, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const drawPortalMedia = (ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, intensity: number) => {
      ctx.fillStyle = "#030303";
      ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
      const R = Math.max(w, h);
      const g1 = ctx.createRadialGradient(cx, cy - h * 0.08, 0, cx, cy - h * 0.08, R * 0.62);
      g1.addColorStop(0, `rgba(255,255,255,${0.14 + 0.1 * intensity})`);
      g1.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g1;
      ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
      const g2 = ctx.createRadialGradient(cx - w * 0.22, cy + h * 0.3, 0, cx - w * 0.22, cy + h * 0.3, R * 0.4);
      g2.addColorStop(0, `rgba(255,196,150,${0.1 + 0.08 * intensity})`);
      g2.addColorStop(1, "rgba(255,196,150,0)");
      ctx.fillStyle = g2;
      ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
      for (const star of s.stars) {
        const x = cx + (star.x - 0.5) * w * 1.4;
        const y = cy + (star.y - 0.5) * h * 1.4;
        if (x < cx - w / 2 || x > cx + w / 2 || y < cy - h / 2 || y > cy + h / 2) continue;
        ctx.globalAlpha = Math.min(1, star.a * (1.5 + intensity * 0.8));
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(x, y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const drawShade = (ctx: CanvasRenderingContext2D) => {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const g = ctx.createLinearGradient(0, H * 0.52, 0, H);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.88)");
      ctx.fillStyle = g;
      ctx.fillRect(0, H * 0.52, W, H * 0.48);
    };

    const draw = (now: number) => {
      const dt = Math.min(40, now - last);
      last = now;
      const W = window.innerWidth;
      const H = window.innerHeight;

      const starCtx = starCanvasRef.current?.getContext("2d");
      if (starCtx && !s.reduced) {
        s.parX += (s.pointerX - 0.5 - (s.parX - 0.5)) * 0.04;
        s.parY += (s.pointerY - 0.5 - (s.parY - 0.5)) * 0.04;
        drawStarfield(starCtx, now);
      } else if (starCtx && s.reduced) {
        drawStarfield(starCtx, 0);
      }

      const ctx = portalCanvasRef.current?.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, W, H);
        const rect = portalBtnRef.current?.getBoundingClientRect();
        if (rect) {
          const e = s.expansion;
          const cx = rect.left + rect.width / 2 + (W / 2 - (rect.left + rect.width / 2)) * e;
          const cy = rect.top + rect.height / 2 + (H / 2 - (rect.top + rect.height / 2)) * e;
          const baseW = rect.width + (W - rect.width) * e;
          const baseH = rect.height + (H - rect.height) * e;
          const w = baseW * s.maskScale;
          const h = baseH * s.maskScale;
          const r = 90 * (1 - e) * Math.max(0.001, s.maskScale);

          // 倾斜缓动
          const k = Math.min(1, dt * 0.009);
          s.rotX += (s.targetX * (1 - e) - s.rotX) * k;
          s.rotY += (s.targetY * (1 - e) - s.rotY) * k;

          if (w > 1 && h > 1) {
            const pts = roundedRectPoints(w, h, r);
            const ax = (s.rotX * Math.PI) / 180;
            const ay = (s.rotY * Math.PI) / 180;
            const cosX = Math.cos(ax);
            const cosY = Math.cos(ay);
            const sinX = Math.sin(ax);
            const sinY = Math.sin(ay);
            ctx.save();
            ctx.beginPath();
            for (let i = 0; i < pts.length; i++) {
              const [x, y] = pts[i];
              const xx = x * cosY;
              const yy = y * cosX;
              const z = x * sinY - y * sinX;
              const p = FOCAL / (FOCAL + z);
              const sx = cx + xx * p;
              const sy = cy + yy * p;
              if (i === 0) ctx.moveTo(sx, sy);
              else ctx.lineTo(sx, sy);
            }
            ctx.closePath();
            ctx.clip();
            drawPortalMedia(ctx, cx, cy, w * 1.05, h * 1.05, e);
            if (e > 0.02) drawShade(ctx);
            ctx.restore();
            // 描边微光
            ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - e)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    // ---------- 旅行 ----------
    const travel = async () => {
      if (s.busy || !latest) return;
      s.busy = true;
      s.targetX = 0;
      s.targetY = 0;
      body.classList.add("portal-transition");
      await animateValue((v) => (s.expansion = v), s.reduced ? 10 : 1100);
      router.push(`/${lang}/blog/${latest.slug}`);
    };
    portalBtnRef.current?.addEventListener("click", travel);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      portalBtnRef.current?.removeEventListener("click", travel);
      body.classList.remove("intro", "intro-ready", "portal-transition");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const factDelay = (i: number) => ({ "--d": `${0.52 + i * 0.16}s` }) as CSSProperties;

  return (
    <main ref={rootRef} className="landing" data-lang={lang}>
      <canvas ref={starCanvasRef} className="starfield-canvas" aria-hidden="true" />
      <div className="shade" aria-hidden="true" />

      {preloadVisible && (
        <>
          <div className="preloader" aria-hidden="true" />
          <div ref={logoRef} className="floating-logo" aria-hidden="true">
            <LogoMark size={58} />
          </div>
          <div className="preloader-count" aria-live="polite">
            <span ref={numRef} className="num">
              0
            </span>
            <span className="percent">%</span>
          </div>
        </>
      )}

      <canvas ref={portalCanvasRef} className="portal-canvas" aria-hidden="true" />

      <aside className="planet-list landing-el" aria-label={labels.categoriesLabel}>
        {categories.map((c, i) => (
          <Link
            key={c.key}
            href={c.href}
            className="planet-item"
            data-cursor-label={labels.enter}
            style={{ "--d": `${0.02 + i * 0.03}s` } as CSSProperties}
          >
            {c.label}
          </Link>
        ))}
        <Link
          href={aboutHref}
          className="planet-item"
          data-cursor-label={labels.enter}
          style={{ "--d": `${0.02 + categories.length * 0.03}s` } as CSSProperties}
        >
          {lang === "zh" ? "关于" : "About"}
        </Link>
      </aside>

      <section className="portal-wrap landing-el" aria-label={labels.latestPost}>
        <div className="portal-heading">
          <span>
            {labels.nextLabel} · {latest ? labels.latestPost : site.name}
          </span>
          {latest && <strong>{latest.title}</strong>}
        </div>
        <button
          ref={portalBtnRef}
          type="button"
          className="portal-btn"
          aria-label={latest ? `${labels.enter}: ${latest.title}` : labels.enter}
          data-cursor-label={labels.enter}
        />
      </section>

      <section className="planet-content landing-el">
        <div>
          <p className="mb-6 max-w-md text-sm text-dim">{labels.intro}</p>
          <h1>{site.name.toUpperCase()}</h1>
          <p className="mt-6 text-xs tracking-[0.2em] text-faint uppercase">{labels.tagline}</p>
        </div>
        <dl className="landing-facts">
          {labels.facts.map((f, i) => (
            <div className="fact-row" key={f.k} style={factDelay(i)}>
              <dt>{f.k}</dt>
              <dd>{f.v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}

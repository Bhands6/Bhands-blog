"use client";

import { useEffect, useRef } from "react";

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface StarSystem {
  name: string;
  x: number;
  y: number;
  st: string;
  dist: string;
  type: string;
  role: string;
}

/** 交互星图（移植自 nexus-station/index.html 的 starmap canvas） */
export default function NexusStarmap({
  systems,
  conns,
  hudCoverage,
  hudCoverageVal,
  hudNodes,
  hudNodesVal,
}: {
  systems: readonly StarSystem[];
  conns: readonly (readonly [number, number])[];
  hudCoverage: string;
  hudCoverageVal: string;
  hudNodes: string;
  hudNodesVal: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const coordRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const cv = cvRef.current;
    const wrap = wrapRef.current;
    const tip = tipRef.current;
    const coordEl = coordRef.current;
    if (!cv || !wrap || !tip || !coordEl) return;
    const cx = cv.getContext("2d");
    if (!cx) return;

    let hover: number | null = null;
    let init = false;
    let raf = 0;
    let animRaf = 0;
    let stopped = false;

    const resize = () => {
      const r = cv.parentElement?.getBoundingClientRect();
      if (!r) return;
      cv.width = r.width;
      cv.height = cv.offsetHeight;
    };
    const pos = (s: StarSystem) => ({ x: s.x * cv.width, y: s.y * cv.height });

    const draw = (p: number) => {
      if (stopped) return;
      cx.clearRect(0, 0, cv.width, cv.height);
      const prog = easeOutCubic(Math.min(p, 1));
      // 网格
      cx.strokeStyle = "rgba(0,240,255,0.03)";
      cx.lineWidth = 1;
      for (let x = 0; x < cv.width; x += 40) {
        cx.beginPath();
        cx.moveTo(x, 0);
        cx.lineTo(x, cv.height);
        cx.stroke();
      }
      for (let y = 0; y < cv.height; y += 40) {
        cx.beginPath();
        cx.moveTo(0, y);
        cx.lineTo(cv.width, y);
        cx.stroke();
      }
      // 航线
      for (const [a, b] of conns) {
        const pa = pos(systems[a]);
        const pb = pos(systems[b]);
        const act = systems[a].st !== "warning" && systems[b].st !== "warning";
        cx.beginPath();
        cx.moveTo(pa.x, pa.y);
        cx.lineTo(lerp(pa.x, pb.x, prog), lerp(pa.y, pb.y, prog));
        cx.strokeStyle = act ? `rgba(0,240,255,${0.12 * prog})` : `rgba(240,192,64,${0.08 * prog})`;
        cx.lineWidth = 1;
        cx.setLineDash(act ? [] : [4, 4]);
        cx.stroke();
        cx.setLineDash([]);
      }
      // 脉冲
      const nx = pos(systems[0]);
      const pr = ((Date.now() / 1000) % 4) / 4 * Math.max(cv.width, cv.height) * 0.5;
      cx.beginPath();
      cx.arc(nx.x, nx.y, pr * prog, 0, Math.PI * 2);
      cx.strokeStyle = `rgba(0,240,255,${0.06 * (1 - pr / (Math.max(cv.width, cv.height) * 0.5))})`;
      cx.lineWidth = 1;
      cx.stroke();
      // 节点
      systems.forEach((s, i) => {
        const pt = pos(s);
        const dx = lerp(nx.x, pt.x, prog);
        const dy = lerp(nx.y, pt.y, prog);
        const hov = hover === i;
        const cur = s.role === "当前" || s.role === "Current";
        let col: string;
        let gc: string;
        if (s.st === "active") {
          col = "#00f0ff";
          gc = "rgba(0,240,255,";
        } else if (s.st === "warning") {
          col = "#f0c040";
          gc = "rgba(240,192,64,";
        } else {
          col = "#ff00aa";
          gc = "rgba(255,0,170,";
        }
        const sz = cur ? 5 : hov ? 4.5 : 3;
        cx.beginPath();
        cx.arc(dx, dy, hov ? sz * 5 : sz * 3, 0, Math.PI * 2);
        cx.fillStyle = `${gc}${hov ? 0.12 : 0.05})`;
        cx.fill();
        cx.beginPath();
        cx.arc(dx, dy, sz, 0, Math.PI * 2);
        cx.fillStyle = col;
        cx.shadowColor = col;
        cx.shadowBlur = hov ? 15 : 8;
        cx.fill();
        cx.shadowBlur = 0;
        if (cur) {
          cx.beginPath();
          cx.arc(dx, dy, sz + 4, 0, Math.PI * 2);
          cx.strokeStyle = `rgba(0,240,255,${0.3 + Math.sin(Date.now() / 500) * 0.15})`;
          cx.lineWidth = 1;
          cx.stroke();
        }
        cx.font = `${hov ? "11px" : "9px"} "Share Tech Mono", monospace`;
        cx.fillStyle = hov ? "#fff" : "rgba(208,216,240,0.5)";
        cx.textAlign = "center";
        cx.fillText(s.name, dx, dy - sz - 8);
      });
    };

    const loop = () => {
      draw(1);
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e: MouseEvent) => {
      const r = cv.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      hover = null;
      let cl = Infinity;
      systems.forEach((s, i) => {
        const p = pos(s);
        const d = Math.hypot(p.x - mx, p.y - my);
        if (d < 20 && d < cl) {
          cl = d;
          hover = i;
        }
      });
      coordEl.textContent = `X:${((mx / cv.width) * 100).toFixed(1)} Y:${((my / cv.height) * 100).toFixed(1)}`;
      if (hover !== null) {
        const s = systems[hover];
        const nameEl = tip.querySelector<HTMLElement>(".tt-name");
        const distEl = tip.querySelector<HTMLElement>(".tt-dist");
        const stEl = tip.querySelector<HTMLElement>(".tt-status");
        if (nameEl) nameEl.textContent = s.name;
        if (distEl) distEl.textContent = `${s.type} · ${s.dist}`;
        if (stEl) {
          stEl.textContent = s.role;
          stEl.className = "tt-status" + (s.st === "warning" ? " warn" : s.st === "alert" ? " alert" : "");
        }
        tip.style.left = mx + 16 + "px";
        tip.style.top = my - 10 + "px";
        tip.classList.add("visible");
      } else {
        tip.classList.remove("visible");
      }
    };
    const onLeave = () => {
      hover = null;
      tip.classList.remove("visible");
    };

    const sObs = new IntersectionObserver(
      (es) => {
        if (es[0]?.isIntersecting && !init) {
          init = true;
          const start = performance.now();
          const dur = 2000;
          const anim = (now: number) => {
            draw(Math.min((now - start) / dur, 1));
            if ((now - start) / dur < 1) {
              animRaf = requestAnimationFrame(anim);
            } else {
              raf = requestAnimationFrame(loop);
            }
          };
          animRaf = requestAnimationFrame(anim);
          sObs.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    resize();
    sObs.observe(cv.parentElement ?? cv);
    window.addEventListener("resize", resize);
    cv.addEventListener("mousemove", onMove);
    cv.addEventListener("mouseleave", onLeave);
    return () => {
      stopped = true;
      sObs.disconnect();
      cancelAnimationFrame(raf);
      cancelAnimationFrame(animRaf);
      window.removeEventListener("resize", resize);
      cv.removeEventListener("mousemove", onMove);
      cv.removeEventListener("mouseleave", onLeave);
    };
  }, [systems, conns]);

  return (
    <div className="starmap-container" ref={wrapRef}>
      <canvas ref={cvRef} className="starmap-canvas" />
      <div className="starmap-hud">
        {hudCoverage}: <span className="highlight">{hudCoverageVal}</span> &nbsp;|&nbsp; {hudNodes}:{" "}
        <span className="highlight">{hudNodesVal}</span> &nbsp;|&nbsp; <span ref={coordRef}>--</span>
      </div>
      <div ref={tipRef} className="starmap-tooltip">
        <div className="tt-name" />
        <div className="tt-dist" />
        <div className="tt-status" />
      </div>
    </div>
  );
}

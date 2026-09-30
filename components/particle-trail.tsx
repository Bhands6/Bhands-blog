"use client";

import { useEffect, useRef } from "react";

/** 鼠标粒子尾迹（移植自 nexus-station/index.html 的 particle-trail） */
export default function ParticleTrail() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const cx = cv.getContext("2d");
    if (!cx) return;

    let raf = 0;
    const pts: { x: number; y: number; vx: number; vy: number; life: number; decay: number; r: number }[] = [];
    let lx = -1;
    let ly = -1;

    const resize = () => {
      cv.width = window.innerWidth;
      cv.height = window.innerHeight;
    };
    const spawn = (x: number, y: number) => {
      for (let i = 0; i < 2; i++) {
        pts.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 1.2,
          vy: (Math.random() - 0.5) * 1.2 - 0.5,
          life: 1,
          decay: Math.random() * 0.015 + 0.01,
          r: Math.random() * 2 + 0.5,
        });
      }
    };
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - lx;
      const dy = e.clientY - ly;
      if (dx * dx + dy * dy > 100) {
        spawn(e.clientX, e.clientY);
        lx = e.clientX;
        ly = e.clientY;
      }
    };
    const update = () => {
      cx.clearRect(0, 0, cv.width, cv.height);
      for (let i = pts.length - 1; i >= 0; i--) {
        const p = pts[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) {
          pts.splice(i, 1);
          continue;
        }
        cx.beginPath();
        cx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        cx.fillStyle = `rgba(0,240,255,${p.life * 0.5})`;
        cx.fill();
        cx.beginPath();
        cx.arc(p.x, p.y, p.r * p.life * 2.5, 0, Math.PI * 2);
        cx.fillStyle = `rgba(0,240,255,${p.life * 0.1})`;
        cx.fill();
      }
      if (pts.length > 200) pts.splice(0, pts.length - 200);
      raf = requestAnimationFrame(update);
    };

    resize();
    raf = requestAnimationFrame(update);
    window.addEventListener("resize", resize);
    document.addEventListener("mousemove", onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("mousemove", onMove);
    };
  }, []);

  return <canvas ref={ref} className="nx-trail" aria-hidden="true" />;
}

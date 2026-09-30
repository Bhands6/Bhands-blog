"use client";

import { useEffect, useRef } from "react";

/** NEXUS 星空背景（移植自 nexus-station/index.html 的 starfield） */
export default function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const cx = cv.getContext("2d");
    if (!cx) return;

    const N = 500;
    let raf = 0;
    let stars: { x: number; y: number; r: number; a: number; s: number; p: number; d: number }[] = [];

    const resize = () => {
      cv.width = window.innerWidth;
      cv.height = window.innerHeight;
    };
    const init = () => {
      stars = Array.from({ length: N }, () => ({
        x: Math.random() * cv.width,
        y: Math.random() * cv.height,
        r: Math.random() * 1.4 + 0.3,
        a: Math.random() * 0.7 + 0.2,
        s: Math.random() * 0.0005 + 0.0002,
        p: Math.random() * Math.PI * 2,
        d: (Math.random() - 0.5) * 0.06,
      }));
    };
    const draw = (t: number) => {
      cx.clearRect(0, 0, cv.width, cv.height);
      const nebulae: [number, number, string][] = [
        [0.3, 0.4, "rgba(0,240,255,0.012)"],
        [0.7, 0.6, "rgba(255,0,170,0.008)"],
      ];
      for (const [fx, fy, col] of nebulae) {
        const g = cx.createRadialGradient(cv.width * fx, cv.height * fy, 0, cv.width * fx, cv.height * fy, cv.width * 0.35);
        g.addColorStop(0, col);
        g.addColorStop(1, "transparent");
        cx.fillStyle = g;
        cx.fillRect(0, 0, cv.width, cv.height);
      }
      for (const s of stars) {
        const tw = Math.sin(t * s.s * 1000 + s.p) * 0.3 + 0.7;
        const a = s.a * tw;
        s.x += s.d;
        s.y -= 0.015;
        if (s.x < 0) s.x = cv.width;
        if (s.x > cv.width) s.x = 0;
        if (s.y < 0) {
          s.y = cv.height;
          s.x = Math.random() * cv.width;
        }
        cx.beginPath();
        cx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        cx.fillStyle = `rgba(200,220,255,${a})`;
        cx.fill();
        if (s.r > 1.1) {
          cx.beginPath();
          cx.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2);
          cx.fillStyle = `rgba(100,180,255,${a * 0.08})`;
          cx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    init();
    raf = requestAnimationFrame(draw);
    const onResize = () => {
      resize();
      init();
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} className="nx-starfield" aria-hidden="true" />;
}

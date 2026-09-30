"use client";

import { useEffect, useRef } from "react";

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** HUD 圆弧仪表（移植自 nexus-station/index.html 的 gauge 动画） */
export default function NexusGauge({
  value,
  color,
  label,
  unit,
}: {
  value: number;
  color: string;
  label: string;
  unit: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const done = { current: false };
    let raf = 0;

    const drawGauge = (prog: number) => {
      const cx = cv.getContext("2d");
      if (!cx) return;
      const w = cv.width;
      const h = cv.height;
      const r = w * 0.36;
      const lw = w * 0.045;
      cx.clearRect(0, 0, w, h);
      // 背景弧
      cx.beginPath();
      cx.arc(w / 2, h / 2, r, (135 * Math.PI) / 180, (405 * Math.PI) / 180);
      cx.strokeStyle = "rgba(0,240,255,0.08)";
      cx.lineWidth = lw;
      cx.lineCap = "round";
      cx.stroke();
      // 数值弧
      const ea = (135 + (value / 100) * 270 * prog) * (Math.PI / 180);
      cx.beginPath();
      cx.arc(w / 2, h / 2, r, (135 * Math.PI) / 180, ea);
      cx.strokeStyle = color;
      cx.lineWidth = lw;
      cx.lineCap = "round";
      cx.shadowColor = color;
      cx.shadowBlur = 12;
      cx.stroke();
      cx.shadowBlur = 0;
      // 刻度
      for (let i = 0; i <= 10; i++) {
        const a = ((135 + i * 27) * Math.PI) / 180;
        const ri = r - lw * 1.4;
        const ro = r - lw * 2.2;
        cx.beginPath();
        cx.moveTo(w / 2 + Math.cos(a) * ri, h / 2 + Math.sin(a) * ri);
        cx.lineTo(w / 2 + Math.cos(a) * ro, h / 2 + Math.sin(a) * ro);
        cx.strokeStyle = i <= value / 10 ? `rgba(0,240,255,${0.3 * prog})` : "rgba(0,240,255,0.05)";
        cx.lineWidth = 1;
        cx.stroke();
      }
      // 文本
      const disp = (parseFloat(label) * prog).toFixed(label.includes(".") ? 2 : 0);
      cx.textAlign = "center";
      cx.textBaseline = "middle";
      cx.font = `bold ${w * 0.14}px Orbitron, sans-serif`;
      cx.fillStyle = `rgba(255,255,255,${prog})`;
      cx.fillText(disp, w / 2, h / 2 - w * 0.02);
      cx.font = `${w * 0.06}px "Share Tech Mono", monospace`;
      cx.fillStyle = `rgba(90,96,128,${prog})`;
      cx.fillText(unit, w / 2, h / 2 + w * 0.1);
    };

    const obs = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (e.isIntersecting && !done.current) {
            done.current = true;
            const start = performance.now();
            const dur = 1800;
            const tick = (now: number) => {
              const t = Math.min((now - start) / dur, 1);
              drawGauge(easeOutCubic(t));
              if (t < 1) raf = requestAnimationFrame(tick);
            };
            raf = requestAnimationFrame(tick);
            obs.disconnect();
          }
        }
      },
      { threshold: 0.4 }
    );
    drawGauge(0);
    obs.observe(cv);
    return () => {
      obs.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, color, label, unit]);

  return <canvas ref={ref} className="gauge-canvas" width={260} height={260} data-value={value} aria-label={`${label} ${unit}`} />;
}

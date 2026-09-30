"use client";

import { useEffect, useRef } from "react";

export interface TerminalLine {
  cls: string; // ok | warn | alert | cmd
  text: string;
  prefix: string;
}

const clsToSpan: Record<string, string> = {
  ok: "success",
  warn: "warn",
  alert: "error",
  cmd: "prompt",
};

/** 系统日志终端（逐行打字揭示，移植自 nexus-station/index.html） */
export default function NexusTerminal({
  titleBar,
  lines,
}: {
  titleBar: string;
  lines: readonly TerminalLine[];
}) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tb = bodyRef.current;
    if (!tb) return;
    const els = Array.from(tb.querySelectorAll<HTMLElement>(".terminal-line"));
    const timers: ReturnType<typeof setTimeout>[] = [];
    const obs = new IntersectionObserver(
      (es) => {
        if (es[0]?.isIntersecting) {
          els.forEach((el, i) => {
            timers.push(setTimeout(() => el.classList.add("typed"), i * 250));
          });
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(tb);
    return () => {
      obs.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [lines]);

  return (
    <div className="terminal">
      <div className="terminal-header">
        <div className="terminal-dot r" aria-hidden="true" />
        <div className="terminal-dot y" aria-hidden="true" />
        <div className="terminal-dot g" aria-hidden="true" />
        <span className="terminal-title-bar">{titleBar}</span>
      </div>
      <div className="terminal-body" ref={bodyRef}>
        {lines.map((l, i) => (
          <div className="terminal-line" key={i}>
            <span className={clsToSpan[l.cls] ?? "prompt"}>{l.prefix}</span> {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}

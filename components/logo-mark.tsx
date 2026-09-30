export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-full border border-white/80 bg-white/10 text-white"
      style={{ width: size + 1, height: size }}
      aria-hidden="true"
    >
      <span
        className="font-display"
        style={{ fontSize: size * 0.52, lineHeight: 1, transform: "translateY(0.03em)" }}
      >
        B
      </span>
    </span>
  );
}

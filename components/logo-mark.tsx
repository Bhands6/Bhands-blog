export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-full border border-cyan/70 bg-cyan/10 text-white"
      style={{
        width: size + 1,
        height: size,
        boxShadow:
          "0 0 16px rgba(0,229,255,0.4), inset 0 0 10px rgba(0,229,255,0.25)",
      }}
      aria-hidden="true"
    >
      <span
        className="font-display"
        style={{
          fontSize: size * 0.52,
          lineHeight: 1,
          transform: "translateY(0.03em)",
          color: "#bdeeff",
          textShadow: "0 0 10px rgba(0,229,255,0.8)",
        }}
      >
        B
      </span>
    </span>
  );
}

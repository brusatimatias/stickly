import { ImageResponse } from "next/og";
import messages from "../../messages/en.json";

// Built once at build time, so it has a single language: English, the default.
export const alt = "Stickly: your week as a board of sticky notes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The board's pastel palette (Tailwind -200 backgrounds, -300 borders).
const STICKERS = [
  { top: -40, left: -30, rotate: -12, bg: "#fef08a", border: "#fde047" },
  { top: 400, left: 40, rotate: 8, bg: "#fbcfe8", border: "#f9a8d4" },
  { top: 60, left: 190, rotate: -4, bg: "#bae6fd", border: "#7dd3fc" },
  { top: -50, left: 900, rotate: 10, bg: "#bbf7d0", border: "#86efac" },
  { top: 380, left: 930, rotate: -8, bg: "#e9d5ff", border: "#d8b4fe" },
  { top: 170, left: 1050, rotate: 5, bg: "#fed7aa", border: "#fdba74" },
];

function Sticker({ top, left, rotate, bg, border }: (typeof STICKERS)[number]) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        width: 220,
        height: 220,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 28,
        background: bg,
        border: `3px solid ${border}`,
        borderRadius: 6,
        boxShadow: "4px 8px 14px rgba(0,0,0,0.18)",
        transform: `rotate(${rotate}deg)`,
      }}
    >
      <div style={{ width: "70%", height: 12, borderRadius: 6, background: "rgba(0,0,0,0.15)" }} />
      <div style={{ width: "100%", height: 12, borderRadius: 6, background: "rgba(0,0,0,0.15)" }} />
      <div style={{ width: "50%", height: 12, borderRadius: 6, background: "rgba(0,0,0,0.15)" }} />
      {/* Folded corner */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          width: 34,
          height: 34,
          background: "rgba(0,0,0,0.15)",
          clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
        }}
      />
    </div>
  );
}

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafafa",
        }}
      >
        {STICKERS.map((sticker) => (
          <Sticker key={`${sticker.top}-${sticker.left}`} {...sticker} />
        ))}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
            padding: "56px 72px",
            maxWidth: 680,
            background: "white",
            border: "2px solid #e4e4e7",
            borderRadius: 32,
            boxShadow: "0 20px 40px rgba(0,0,0,0.12)",
          }}
        >
          <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -3, color: "#18181b" }}>Stickly</div>
          <div style={{ fontSize: 34, lineHeight: 1.35, color: "#52525b", textAlign: "center" }}>
            {messages.auth.tagline}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}

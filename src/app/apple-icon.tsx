import { ImageResponse } from "next/og";

// Same sticky note as `icon.tsx`, on an opaque background: iOS fills a
// transparent home-screen icon with black.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafafa",
        }}
      >
        <div
          style={{
            display: "flex",
            position: "relative",
            width: 120,
            height: 120,
            background: "#fde68a",
            border: "6px solid #f59e0b",
            borderRadius: 10,
            transform: "rotate(-6deg)",
          }}
        >
          <div
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 40,
              height: 40,
              background: "rgba(255,255,255,0.7)",
              clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}

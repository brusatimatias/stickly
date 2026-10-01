import { ImageResponse } from "next/og";

// Same sticky note as `icon.tsx`, on an opaque background: iOS fills a
// transparent home-screen icon with black. Also the install icons the
// manifest lists (192 and 512), served at `/apple-icon/<size>`.
const SIZES = [180, 192, 512];

export function generateImageMetadata() {
  return SIZES.map((size) => ({
    id: String(size),
    size: { width: size, height: size },
    contentType: "image/png",
  }));
}

export default async function AppleIcon({ id }: { id: Promise<string> }) {
  const size = Number(await id);
  // Drawn for 180 px and scaled, so every size looks the same.
  const scale = size / 180;

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
            width: 120 * scale,
            height: 120 * scale,
            background: "#fde68a",
            border: `${6 * scale}px solid #f59e0b`,
            borderRadius: 10 * scale,
            transform: "rotate(-6deg)",
          }}
        >
          <div
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 40 * scale,
              height: 40 * scale,
              background: "rgba(255,255,255,0.7)",
              clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
            }}
          />
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}

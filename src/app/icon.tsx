import { ImageResponse } from "next/og";

// The favicon (32), and the notifications' icon (192, see public/sw.js),
// served at `/icon/<size>`. Transparent around the note, unlike `apple-icon`.
const SIZES = [32, 192];

export function generateImageMetadata() {
  return SIZES.map((size) => ({
    id: String(size),
    size: { width: size, height: size },
    contentType: "image/png",
  }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const size = Number(await id);
  // Drawn for 32 px and scaled, so every size looks the same.
  const scale = size / 32;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            position: "relative",
            width: 26 * scale,
            height: 26 * scale,
            background: "#fde68a",
            border: `${2 * scale}px solid #f59e0b`,
            borderRadius: 3 * scale,
            transform: "rotate(-6deg)",
          }}
        >
          <div
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 10 * scale,
              height: 10 * scale,
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

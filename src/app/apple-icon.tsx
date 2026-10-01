import { ImageResponse } from "next/og";

// Same sticky note as `icon.tsx`, on the note's yellow filling the whole
// icon: home screens need it opaque (iOS fills transparency with black,
// Android puts the icon on a white circle) and crop it to their own shape.
// Also the install icons the manifest lists (192 and 512), served at
// `/apple-icon/<size>`; the note stays inside the central circle Android
// keeps when it crops a maskable icon.
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
          background: "#fde68a",
        }}
      >
        <div
          style={{
            display: "flex",
            position: "relative",
            width: 100 * scale,
            height: 100 * scale,
            background: "#fde68a",
            border: `${5 * scale}px solid #f59e0b`,
            borderRadius: 8 * scale,
            transform: "rotate(-6deg)",
          }}
        >
          <div
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 33 * scale,
              height: 33 * scale,
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

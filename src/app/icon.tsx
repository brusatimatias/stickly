import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
            width: 26,
            height: 26,
            background: "#fde68a",
            border: "2px solid #f59e0b",
            borderRadius: 3,
            transform: "rotate(-6deg)",
          }}
        >
          <div
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 0,
              height: 0,
              borderStyle: "solid",
              borderWidth: "0 0 10px 10px",
              borderColor: "transparent transparent rgba(255,255,255,0.7) transparent",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}

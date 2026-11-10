import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Browser-tab icon: the Digi Presence mark (gold D on ink, blue dot). */
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
          background: "#050505",
          borderRadius: 14,
          color: "#D4AF37",
          fontSize: 42,
          fontWeight: 800,
          position: "relative",
        }}
      >
        D
        <div style={{ position: "absolute", right: 7, bottom: 7, width: 11, height: 11, borderRadius: 6, background: "#0A84FF" }} />
      </div>
    ),
    { ...size }
  );
}

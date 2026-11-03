import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

export const runtime = "edge";
export const alt = SITE.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0a0a0a",
          color: "#ffffff",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        {/* Red accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: 14,
            width: "100%",
            background: "#ed2024",
          }}
        />

        {/* Dot pattern */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.07,
            backgroundImage:
              "radial-gradient(circle, #ffffff 1.5px, transparent 1.5px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Main stack */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "72px 80px 64px",
            position: "relative",
          }}
        >
          {/* Eyebrow */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 20,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#ff5d5d",
              fontWeight: 700,
            }}
          >
            <div style={{ width: 10, height: 10, background: "#ed2024" }} />
            News · Analysis · Insight
          </div>

          {/* Wordmark */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div
              style={{
                fontSize: 130,
                fontWeight: 900,
                lineHeight: 0.95,
                letterSpacing: "-0.03em",
                color: "#ffffff",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <span>THE INSIGHT</span>
              <span style={{ color: "#ed2024" }}>NEWS</span>
            </div>
            <div
              style={{
                fontSize: 30,
                color: "rgba(255,255,255,0.7)",
                fontWeight: 500,
                maxWidth: 900,
              }}
            >
              {SITE.tagline}
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 22,
              color: "rgba(255,255,255,0.5)",
              fontWeight: 600,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: "#ed2024", fontSize: 26 }}>●</span>
              theinsightnews.co
            </div>
            <div>ยึดมั่นในความจริง · เพื่อสังคม</div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}

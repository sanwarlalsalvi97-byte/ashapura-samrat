import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { C, body, display } from "../theme";
import { Rise } from "../components/Rise";

export const S1Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame: frame - 4, fps, config: { damping: 14, stiffness: 110, mass: 1.1 } });
  const strike = interpolate(frame, [46, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const float = Math.sin(frame / 26) * 8;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "0 90px",
        gap: 52,
      }}
    >
      <div
        style={{
          transform: `scale(${interpolate(logo, [0, 1], [0.55, 1])}) translateY(${interpolate(logo, [0, 1], [70, float])}px) rotate(${interpolate(logo, [0, 1], [-12, 0])}deg)`,
          opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" }),
          borderRadius: 72,
          boxShadow: "0 50px 120px rgba(23,163,74,0.45)",
        }}
      >
        <Img src={staticFile("images/logo.png")} style={{ width: 340, borderRadius: 72 }} />
      </div>

      <Rise delay={20} y={40}>
        <div style={{ position: "relative", textAlign: "center" }}>
          <div
            style={{
              fontFamily: display,
              fontWeight: 700,
              fontSize: 74,
              color: C.dim,
              display: "inline-block",
              position: "relative",
            }}
          >
            डायरी वाला हिसाब
            <div
              style={{
                position: "absolute",
                left: 0,
                top: "54%",
                height: 7,
                borderRadius: 4,
                background: C.amber,
                width: `${strike * 100}%`,
              }}
            />
          </div>
        </div>
      </Rise>

      <Rise delay={64} y={70} damping={16} stiffness={120}>
        <h1
          style={{
            fontFamily: display,
            fontWeight: 800,
            fontSize: 116,
            lineHeight: 1.06,
            color: C.cream,
            margin: 0,
            textAlign: "center",
          }}
        >
          अब सब कुछ
          <br />
          <span style={{ color: C.green }}>मोबाइल में।</span>
        </h1>
      </Rise>

      <Rise delay={86} y={26}>
        <p
          style={{
            fontFamily: body,
            fontSize: 36,
            color: C.dim,
            margin: 0,
            textAlign: "center",
            letterSpacing: 1,
          }}
        >
          ठेकेदारों के लिए बना हिंदी ऐप
        </p>
      </Rise>
    </AbsoluteFill>
  );
};

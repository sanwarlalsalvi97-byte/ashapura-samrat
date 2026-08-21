import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { C, body, display } from "../theme";
import { Rise } from "../components/Rise";

const FEATURES = ["हाजिरी", "मजदूरी", "एडवांस", "कैशबुक", "रिपोर्ट", "UPI", "GPS", "पंचांग"];

export const S6Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame, fps, config: { damping: 15, stiffness: 120, mass: 1 } });
  const glow = interpolate(Math.sin(frame / 22), [-1, 1], [0.35, 0.7]);

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 90px",
        gap: 40,
      }}
    >
      <div
        style={{
          transform: `scale(${interpolate(logo, [0, 1], [0.6, 1])})`,
          borderRadius: 64,
          boxShadow: `0 40px 120px rgba(23,163,74,${glow})`,
        }}
      >
        <Img src={staticFile("images/logo.png")} style={{ width: 260, borderRadius: 64 }} />
      </div>

      <Rise delay={12} y={44}>
        <div
          style={{
            fontFamily: display,
            fontWeight: 800,
            fontSize: 96,
            color: C.cream,
            textAlign: "center",
            lineHeight: 1.05,
          }}
        >
          आशापुरा सम्राट
        </div>
      </Rise>

      <Rise delay={22} y={26}>
        <div
          style={{
            fontFamily: body,
            fontSize: 34,
            color: C.dim,
            letterSpacing: 3,
            textAlign: "center",
          }}
        >
          हाजिरी · मजदूरी · मैनेजमेंट
        </div>
      </Rise>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          justifyContent: "center",
          maxWidth: 880,
        }}
      >
        {FEATURES.map((f, i) => (
          <Rise key={f} delay={34 + i * 5} y={18}>
            <div
              style={{
                fontFamily: body,
                fontWeight: 600,
                fontSize: 28,
                color: C.cream,
                padding: "12px 26px",
                borderRadius: 999,
                border: `1px solid ${C.line}`,
                background: "rgba(23,163,74,0.12)",
              }}
            >
              {f}
            </div>
          </Rise>
        ))}
      </div>

      <Rise delay={86} y={50} damping={14}>
        <div
          style={{
            marginTop: 20,
            padding: "30px 70px",
            borderRadius: 999,
            background: `linear-gradient(140deg, ${C.green}, ${C.greenDeep})`,
            fontFamily: display,
            fontWeight: 800,
            fontSize: 54,
            color: "#062012",
            boxShadow: "0 30px 80px rgba(23,163,74,0.45)",
            transform: `translateY(${Math.sin(frame / 20) * 5}px)`,
          }}
        >
          फ्री में शुरू करें
        </div>
      </Rise>

      <Rise delay={104} y={22}>
        <div style={{ fontFamily: body, fontSize: 32, color: C.amber, letterSpacing: 2 }}>
          Google Play पर उपलब्ध
        </div>
      </Rise>
    </AbsoluteFill>
  );
};

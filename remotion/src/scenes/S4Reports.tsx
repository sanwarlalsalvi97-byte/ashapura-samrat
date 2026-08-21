import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { C, body, display } from "../theme";
import { Rise } from "../components/Rise";
import { Scene, Kicker, Headline } from "../components/SceneShell";

const BARS = [0.42, 0.66, 0.35, 0.82, 0.55, 0.95, 0.7];

export const S4Reports: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <Scene>
      <Kicker>कैशबुक और रिपोर्ट</Kicker>
      <Headline size={94}>
        जमा, खर्च,
        <br />
        <span style={{ color: C.green }}>बैलेंस — एक जगह</span>
      </Headline>

      <Rise delay={16} y={50}>
        <div
          style={{
            width: 900,
            height: 420,
            background: "rgba(243,240,230,0.045)",
            border: `1px solid ${C.line}`,
            borderRadius: 40,
            padding: 42,
            display: "flex",
            alignItems: "flex-end",
            gap: 22,
            marginTop: 10,
          }}
        >
          {BARS.map((h, i) => {
            const s = spring({
              frame: frame - 30 - i * 6,
              fps,
              config: { damping: 18, stiffness: 130 },
            });
            const isPeak = i === 5;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${h * 100 * s}%`,
                  borderRadius: 18,
                  background: isPeak
                    ? `linear-gradient(180deg, ${C.amber}, rgba(247,183,51,0.35))`
                    : `linear-gradient(180deg, ${C.green}, rgba(23,163,74,0.25))`,
                }}
              />
            );
          })}
        </div>
      </Rise>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", width: 900 }}>
        {["PDF रिपोर्ट", "Excel एक्सपोर्ट", "साइट-वाइज हिसाब", "व्हाट्सएप पर शेयर"].map((t, i) => (
          <Rise key={t} delay={78 + i * 9} y={24}>
            <div
              style={{
                fontFamily: body,
                fontWeight: 600,
                fontSize: 30,
                color: C.cream,
                padding: "16px 30px",
                borderRadius: 999,
                border: `1px solid ${C.line}`,
                background: "rgba(23,163,74,0.12)",
              }}
            >
              {t}
            </div>
          </Rise>
        ))}
      </div>

      <Rise delay={120} y={20}>
        <p
          style={{
            fontFamily: display,
            fontWeight: 700,
            fontSize: 40,
            color: C.cream,
            margin: 0,
            opacity: interpolate(frame, [120, 140], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          महीने के अंत की भागदौड़ खत्म।
        </p>
      </Rise>
    </Scene>
  );
};

import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { C, body, display } from "../theme";
import { Rise } from "../components/Rise";
import { Scene, Kicker, Headline } from "../components/SceneShell";

export const S5Upi: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const paid = spring({ frame: frame - 68, fps, config: { damping: 12, stiffness: 180 } });
  const ring = interpolate(frame % 60, [0, 60], [0, 1]);

  return (
    <Scene>
      <Kicker>पेमेंट और GPS हाजिरी</Kicker>
      <Headline size={92}>
        UPI से भुगतान,
        <br />
        <span style={{ color: C.green }}>साइट पर ही हाजिरी</span>
      </Headline>

      <Rise delay={16} y={52}>
        <div
          style={{
            width: 900,
            borderRadius: 40,
            padding: "40px 44px",
            background: "linear-gradient(150deg, rgba(23,163,74,0.20), rgba(8,18,13,0.6))",
            border: `1px solid ${C.line}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 10,
            boxShadow: "0 40px 90px rgba(0,0,0,0.45)",
          }}
        >
          <div>
            <div style={{ fontFamily: body, fontSize: 30, color: C.dim }}>सुरेश को भुगतान</div>
            <div style={{ fontFamily: display, fontWeight: 800, fontSize: 84, color: C.cream }}>
              ₹21,500
            </div>
            <div
              style={{
                fontFamily: body,
                fontSize: 30,
                fontWeight: 700,
                color: C.green,
                opacity: paid,
                transform: `translateY(${interpolate(paid, [0, 1], [14, 0])}px)`,
              }}
            >
              UPI से भेजा गया ✓
            </div>
          </div>
          <div
            style={{
              width: 150,
              height: 150,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `conic-gradient(${C.green} ${Math.min(paid, 1) * 360}deg, rgba(243,240,230,0.10) 0deg)`,
            }}
          >
            <div
              style={{
                width: 118,
                height: 118,
                borderRadius: 999,
                background: C.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: display,
                fontWeight: 800,
                fontSize: 56,
                color: C.green,
                transform: `scale(${1 + 0.08 * Math.sin(paid * Math.PI)})`,
              }}
            >
              ✓
            </div>
          </div>
        </div>
      </Rise>

      <Rise delay={92} y={40}>
        <div
          style={{
            width: 900,
            borderRadius: 40,
            padding: "34px 44px",
            border: `1px solid ${C.line}`,
            background: "rgba(243,240,230,0.045)",
            display: "flex",
            alignItems: "center",
            gap: 30,
          }}
        >
          <div
            style={{
              width: 92,
              height: 92,
              borderRadius: 999,
              border: `3px solid ${C.amber}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 0 ${ring * 26}px rgba(247,183,51,${0.22 * (1 - ring)})`,
            }}
          >
            <div style={{ width: 26, height: 26, borderRadius: 999, background: C.amber }} />
          </div>
          <div>
            <div style={{ fontFamily: display, fontWeight: 700, fontSize: 44, color: C.cream }}>
              GPS पंच इन / पंच आउट
            </div>
            <div style={{ fontFamily: body, fontSize: 30, color: C.dim }}>
              साइट की 50 मीटर परिधि में ही हाजिरी — फर्जी हाजिरी बंद
            </div>
          </div>
        </div>
      </Rise>
    </Scene>
  );
};

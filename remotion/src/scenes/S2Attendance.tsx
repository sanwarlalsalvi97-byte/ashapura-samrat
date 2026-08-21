import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { C, body, display } from "../theme";
import { Rise } from "../components/Rise";
import { Scene, Kicker, Headline } from "../components/SceneShell";

const MARKS = ["A", "P", "½", "P+½", "P+P", "OT", "PA"];
const WORKERS = [
  { name: "रामलाल", pick: 1 },
  { name: "सुरेश", pick: 5 },
  { name: "मुकेश", pick: 3 },
];

const Row: React.FC<{ name: string; pick: number; delay: number }> = ({ name, pick, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tapAt = delay + 26;
  const tap = spring({ frame: frame - tapAt, fps, config: { damping: 11, stiffness: 220 } });
  const chosen = frame >= tapAt;

  return (
    <Rise delay={delay} y={40}>
      <div
        style={{
          background: "rgba(243,240,230,0.05)",
          border: `1px solid ${C.line}`,
          borderRadius: 30,
          padding: "26px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          backgroundImage: chosen
            ? `linear-gradient(90deg, rgba(23,163,74,${0.16 * tap}), transparent)`
            : undefined,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: display, fontWeight: 700, fontSize: 40, color: C.cream }}>
            {name}
          </span>
          <span
            style={{
              fontFamily: body,
              fontSize: 26,
              color: C.green,
              opacity: chosen ? tap : 0,
              fontWeight: 700,
            }}
          >
            सेव ✓
          </span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {MARKS.map((m, i) => {
            const active = chosen && i === pick;
            const s = active ? tap : 0;
            return (
              <div
                key={m}
                style={{
                  flex: 1,
                  height: 78,
                  borderRadius: 22,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: body,
                  fontWeight: 700,
                  fontSize: 26,
                  color: active ? "#08120D" : C.dim,
                  background: active
                    ? `linear-gradient(160deg, ${C.green}, ${C.greenDeep})`
                    : "rgba(243,240,230,0.06)",
                  border: `1px solid ${active ? C.green : C.line}`,
                  transform: `scale(${1 + 0.14 * Math.sin(s * Math.PI)})`,
                  boxShadow: active ? `0 16px 40px rgba(23,163,74,${0.5 * s})` : undefined,
                }}
              >
                {m}
              </div>
            );
          })}
        </div>
      </div>
    </Rise>
  );
};

export const S2Attendance: React.FC = () => {
  const frame = useCurrentFrame();
  const count = Math.round(interpolate(frame, [70, 125], [0, 42], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));

  return (
    <Scene>
      <Kicker>हाजिरी</Kicker>
      <Headline size={94}>
        एक टैप में
        <br />
        <span style={{ color: C.green }}>पूरी हाजिरी</span>
      </Headline>

      <div style={{ display: "flex", flexDirection: "column", gap: 22, width: "100%", marginTop: 10 }}>
        {WORKERS.map((w, i) => (
          <Row key={w.name} name={w.name} pick={w.pick} delay={22 + i * 16} />
        ))}
      </div>

      <Rise delay={92} y={30}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 6 }}>
          <span style={{ fontFamily: display, fontWeight: 800, fontSize: 70, color: C.amber }}>
            {count}
          </span>
          <span style={{ fontFamily: body, fontSize: 34, color: C.dim }}>
            मजदूर, 10 सेकंड में
          </span>
        </div>
      </Rise>
    </Scene>
  );
};

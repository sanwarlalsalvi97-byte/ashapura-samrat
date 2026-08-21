import { useCurrentFrame, interpolate } from "remotion";
import { C, body, display } from "../theme";
import { Rise } from "../components/Rise";
import { Scene, Kicker, Headline } from "../components/SceneShell";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

const Line: React.FC<{
  label: string;
  value: number;
  delay: number;
  color?: string;
  big?: boolean;
}> = ({ label, value, delay, color = C.cream, big }) => {
  const frame = useCurrentFrame();
  const v = interpolate(frame, [delay, delay + 40], [0, value], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <Rise delay={delay} y={28}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: big ? "30px 0 4px" : "18px 0",
          borderTop: big ? `1px solid ${C.line}` : undefined,
        }}
      >
        <span style={{ fontFamily: body, fontSize: big ? 38 : 34, color: C.dim, fontWeight: 600 }}>
          {label}
        </span>
        <span
          style={{
            fontFamily: display,
            fontWeight: 800,
            fontSize: big ? 78 : 46,
            color,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {inr(v)}
        </span>
      </div>
    </Rise>
  );
};

export const S3Wages: React.FC = () => (
  <Scene>
    <Kicker>मजदूरी और एडवांस</Kicker>
    <Headline size={94}>
      हिसाब खुद-ब-खुद,
      <br />
      <span style={{ color: C.green }}>पाई-पाई सही</span>
    </Headline>

    <Rise delay={18} y={54}>
      <div
        style={{
          width: 900,
          background: "linear-gradient(160deg, rgba(23,163,74,0.14), rgba(243,240,230,0.04))",
          border: `1px solid ${C.line}`,
          borderRadius: 40,
          padding: "34px 42px 42px",
          marginTop: 10,
          boxShadow: "0 40px 90px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ fontFamily: body, fontSize: 30, color: C.amber, fontWeight: 700, letterSpacing: 2 }}>
          रामलाल · अगस्त
        </div>
        <Line label="कुल मजदूरी" value={24800} delay={34} />
        <Line label="पिछला बकाया" value={3200} delay={48} />
        <Line label="एडवांस" value={-6500} delay={62} color={C.amber} />
        <Line label="अब देना है" value={21500} delay={78} color={C.green} big />
      </div>
    </Rise>

    <Rise delay={104} y={24}>
      <p style={{ fontFamily: body, fontSize: 34, color: C.dim, margin: 0 }}>
        एडवांस हर महीने आगे कैरी-फॉरवर्ड — कभी गड़बड़ नहीं
      </p>
    </Rise>
  </Scene>
);

import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { C } from "../theme";

export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 60;
  const drift2 = Math.cos(frame / 120) * 80;
  const pulse = interpolate(Math.sin(frame / 70), [-1, 1], [0.75, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 900px at ${50 + drift / 12}% ${18 + drift / 40}%, rgba(23,163,74,0.30), transparent 70%)`,
          opacity: pulse,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(760px 760px at ${18 + drift2 / 18}% 86%, rgba(247,183,51,0.14), transparent 72%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(243,240,230,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(243,240,230,0.045) 1px, transparent 1px)",
          backgroundSize: "120px 120px",
          transform: `translateY(${(frame % 120) * -1}px)`,
          opacity: 0.5,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(8,18,13,0.55) 0%, transparent 30%, transparent 70%, rgba(8,18,13,0.8) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import React from "react";

export const Rise: React.FC<{
  delay?: number;
  y?: number;
  damping?: number;
  stiffness?: number;
  blur?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ delay = 0, y = 46, damping = 22, stiffness = 140, blur = true, style, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping, stiffness, mass: 0.9 } });
  const opacity = interpolate(frame - delay, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        opacity,
        transform: `translateY(${interpolate(s, [0, 1], [y, 0])}px) scale(${interpolate(s, [0, 1], [0.96, 1])})`,
        filter: blur ? `blur(${interpolate(s, [0, 1], [10, 0])}px)` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

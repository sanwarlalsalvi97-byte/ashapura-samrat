import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import React from "react";
import { C, body, display } from "../theme";
import { Rise } from "./Rise";

export const Kicker: React.FC<{ children: React.ReactNode; delay?: number }> = ({
  children,
  delay = 0,
}) => (
  <Rise delay={delay} y={24}>
    <div
      style={{
        fontFamily: body,
        fontWeight: 700,
        fontSize: 30,
        letterSpacing: 4,
        color: C.amber,
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  </Rise>
);

export const Headline: React.FC<{
  children: React.ReactNode;
  delay?: number;
  size?: number;
}> = ({ children, delay = 6, size = 104 }) => (
  <Rise delay={delay} y={60} damping={26}>
    <h1
      style={{
        fontFamily: display,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1.08,
        color: C.cream,
        margin: 0,
        maxWidth: 900,
      }}
    >
      {children}
    </h1>
  </Rise>
);

export const Scene: React.FC<{ children: React.ReactNode; align?: "flex-start" | "center" }> = ({
  children,
  align = "flex-start",
}) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 160], [1.03, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill
      style={{
        padding: "150px 90px 170px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: align,
        gap: 34,
        transform: `scale(${scale})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

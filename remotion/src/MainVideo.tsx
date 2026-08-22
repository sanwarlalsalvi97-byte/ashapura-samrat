import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { Background } from "./components/Background";
import { S1Hook } from "./scenes/S1Hook";
import { S2Attendance } from "./scenes/S2Attendance";
import { S3Wages } from "./scenes/S3Wages";
import { S4Reports } from "./scenes/S4Reports";
import { S5Upi } from "./scenes/S5Upi";
import { S6Cta } from "./scenes/S6Cta";

const T = 18;
const timing = springTiming({ config: { damping: 200 }, durationInFrames: T });

export const DURATIONS = [130, 165, 165, 155, 165, 210];
export const TOTAL = DURATIONS.reduce((a, b) => a + b, 0) - 5 * T;

export const MainVideo: React.FC = () => (
  <AbsoluteFill>
    <Background />
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={DURATIONS[0]}>
        <S1Hook />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={DURATIONS[1]}>
        <S2Attendance />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={DURATIONS[2]}>
        <S3Wages />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={DURATIONS[3]}>
        <S4Reports />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={DURATIONS[4]}>
        <S5Upi />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={DURATIONS[5]}>
        <S6Cta />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);

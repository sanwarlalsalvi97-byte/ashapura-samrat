import { loadFont as loadDisplay } from "@remotion/google-fonts/Mukta";
import { loadFont as loadBody } from "@remotion/google-fonts/NotoSansDevanagari";

export const display = loadDisplay("normal", {
  weights: ["600", "700", "800"],
  subsets: ["devanagari", "latin"],
}).fontFamily;

export const body = loadBody("normal", {
  weights: ["400", "600", "700"],
  subsets: ["devanagari", "latin"],
}).fontFamily;

export const C = {
  bg: "#08120D",
  bg2: "#0D2019",
  green: "#17A34A",
  greenDeep: "#0E7A3A",
  greenSoft: "rgba(23,163,74,0.16)",
  amber: "#F7B733",
  cream: "#F3F0E6",
  dim: "rgba(243,240,230,0.62)",
  line: "rgba(243,240,230,0.12)",
};

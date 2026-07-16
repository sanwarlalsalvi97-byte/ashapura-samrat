import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initTheme } from "./lib/theme";
import { initFontSize } from "./lib/font-size";
import { initNative } from "./lib/native";

initTheme();
initFontSize();
initNative();
createRoot(document.getElementById("root")!).render(<App />);

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initTheme } from "./lib/theme";
import { initFontSize } from "./lib/font-size";

initTheme();
initFontSize();
createRoot(document.getElementById("root")!).render(<App />);

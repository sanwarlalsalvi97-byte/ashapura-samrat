import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initTheme } from "./lib/theme";
import { initFontSize } from "./lib/font-size";
import { initNative } from "./lib/native";
import { initCrashlytics } from "./lib/crashlytics";
import { runAdPrivacyCheck, formatAdPrivacyReport } from "./lib/ad-privacy";

initTheme();
initFontSize();
initNative();
initCrashlytics();
// Boot-time smoke test: logs whether Ad ID / AdServices reporting is really off.
void runAdPrivacyCheck().then((r) => console.log(formatAdPrivacyReport(r)));
createRoot(document.getElementById("root")!).render(<App />);

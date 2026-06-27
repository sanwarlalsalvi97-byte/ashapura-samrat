export type FontSize = "small" | "medium" | "large";

const KEY = "hajiri-font-size";
const SIZES: Record<FontSize, string> = {
  small: "15px",
  medium: "17px",
  large: "19px",
};

export function getFontSize(): FontSize {
  if (typeof localStorage === "undefined") return "medium";
  const v = (localStorage.getItem(KEY) as FontSize | null) || "medium";
  return v === "small" || v === "medium" || v === "large" ? v : "medium";
}

export function applyFontSize(size: FontSize) {
  const root = document.documentElement;
  const px = SIZES[size];
  // Set both: CSS var (used by index.css fallback) and inline style
  // (highest specificity) so the choice applies across every page
  // — Attendance, Settings, Home, Workers, etc. — without any
  // stylesheet rule being able to override it.
  root.style.setProperty("--app-base-font-size", px);
  root.style.setProperty("font-size", px, "important");
  root.dataset.fontSize = size;
}

export function setFontSize(size: FontSize) {
  try {
    localStorage.setItem(KEY, size);
  } catch {
    /* ignore */
  }
  applyFontSize(size);
  // Notify any listeners (multi-tab / future components) so they can react.
  try {
    window.dispatchEvent(new CustomEvent("app:font-size", { detail: size }));
  } catch {
    /* ignore */
  }
}

export function initFontSize() {
  applyFontSize(getFontSize());
  // Cross-tab sync: if user changes size in another tab, mirror it here.
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key === KEY && e.newValue) {
        const v = e.newValue as FontSize;
        if (v === "small" || v === "medium" || v === "large") {
          applyFontSize(v);
        }
      }
    });
  }
}

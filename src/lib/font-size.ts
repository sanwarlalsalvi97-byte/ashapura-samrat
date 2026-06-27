export type FontSize = "small" | "medium" | "large";

const KEY = "hajiri-font-size";
const SIZES: Record<FontSize, string> = {
  small: "15px",
  medium: "17px",
  large: "19px",
};

export function getFontSize(): FontSize {
  const v = (localStorage.getItem(KEY) as FontSize | null) || "medium";
  return v === "small" || v === "medium" || v === "large" ? v : "medium";
}

export function applyFontSize(size: FontSize) {
  document.documentElement.style.fontSize = SIZES[size];
}

export function setFontSize(size: FontSize) {
  localStorage.setItem(KEY, size);
  applyFontSize(size);
}

export function initFontSize() {
  applyFontSize(getFontSize());
}

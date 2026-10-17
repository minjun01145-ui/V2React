import { FONT_CATALOG } from "./catalog.ts";
import { registerFont } from "./loader.ts";

export const DEFAULT_APP_FONT_ID = "default";

/** Firestore values are untrusted; unknown or removed catalog entries use the app default. */
export function parseAppFontId(value: unknown): string {
  return typeof value === "string" && FONT_CATALOG.some((font) => font.id === value) ? value : DEFAULT_APP_FONT_ID;
}

/** CSS updates synchronously for preview; only the selected catalog face is registered. */
export function applyAppFont(id: string): void {
  const font = FONT_CATALOG.find((entry) => entry.id === id);
  if (font) {
    document.documentElement.style.setProperty("--app-font-family", font.family);
  } else {
    document.documentElement.style.removeProperty("--app-font-family");
  }
  void registerFont(font ?? FONT_CATALOG[0]!);
}

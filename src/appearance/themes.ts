/** Each theme recolours the shared tokens (src/styles/themes.css) and pairs a default font. */
export const THEMES = [
  { id: "classic", label: "기본", fontId: "noto-sans-kr" },
  { id: "candy", label: "딸기 우유", fontId: "jua" },
  { id: "forest", label: "숲속 캠프", fontId: "cafe24-ssurround" },
  { id: "ocean", label: "청량 바다", fontId: "pretendard" },
] as const;

export type ThemeId = typeof THEMES[number]["id"];
export function parseThemeId(value: unknown): ThemeId {
  return THEMES.find((theme) => theme.id === value)?.id ?? "classic";
}
export function themeFontId(themeId: ThemeId): string {
  return THEMES.find((theme) => theme.id === themeId)!.fontId;
}

export const THEMES = [
  { id: "classic", label: "기본", fontId: "noto-sans-kr" },
  { id: "arcade", label: "레트로 아케이드", fontId: "nanum-gothic-coding" },
  { id: "paper", label: "종이 공방", fontId: "gowun-dodum" },
  { id: "space", label: "우주 탐사", fontId: "orbit" },
] as const;

export type ThemeId = typeof THEMES[number]["id"];
export function parseThemeId(value: unknown): ThemeId {
  return THEMES.find((theme) => theme.id === value)?.id ?? "classic";
}
export function themeFontId(themeId: ThemeId): string {
  return THEMES.find((theme) => theme.id === themeId)!.fontId;
}

export const SLIDE_FONT_FAMILY = "\"Pretendard Variable\", Pretendard, sans-serif";

/**
 * Canvas text does not trigger web-font loading, and Pretendard is split into
 * unicode-range subsets, so load the glyphs a slide actually uses before drawing it.
 */
export async function loadSlideFonts(texts: readonly string[]): Promise<void> {
  const sample = texts.join("");
  if (!sample || typeof document === "undefined" || !document.fonts) return;
  await Promise.all([
    document.fonts.load(`400 32px "Pretendard Variable"`, sample),
    document.fonts.load(`800 32px "Pretendard Variable"`, sample),
  ]).catch(() => undefined);
}

export function collectSlideTexts(json: unknown): string[] {
  if (typeof json !== "object" || json === null || !Array.isArray((json as { objects?: unknown }).objects)) return [];
  return (json as { objects: unknown[] }).objects.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const text = (item as { text?: unknown }).text;
    return typeof text === "string" ? [text] : [];
  });
}

import { cache, FabricText, Group, IText, type FabricObject, type StaticCanvas } from "fabric";

export const SLIDE_FONT_FAMILY = "'Noto Sans KR', sans-serif";

/**
 * Canvas text does not trigger web-font loading, so load the Noto Sans KR weights
 * a slide draws before rendering it.
 */
export async function loadSlideFonts(texts: readonly string[]): Promise<void> {
  const sample = texts.join("");
  if (!sample || typeof document === "undefined" || !document.fonts) return;
  await Promise.all([
    document.fonts.load(`400 32px "Noto Sans KR"`, sample),
    document.fonts.load(`800 32px "Noto Sans KR"`, sample),
  ]).catch(() => undefined);
  // Fabric retains widths measured with a fallback face, even after the font loads.
  cache.clearFontCache(SLIDE_FONT_FAMILY);
}

/** Re-measure existing text when new font subsets/weights finish loading during editing. */
export function watchSlideFonts(canvas: StaticCanvas): () => void {
  const fonts = document.fonts;
  const refresh = (): void => {
    cache.clearFontCache();
    const refreshObject = (object: FabricObject): void => {
      if (object instanceof Group) object.getObjects().forEach(refreshObject);
      if (!(object instanceof FabricText)) return;
      object.initDimensions();
      object.set({ dirty: true });
      object.setCoords();
      if (object instanceof IText && object.isEditing) object._updateTextarea();
    };
    canvas.getObjects().forEach(refreshObject);
    canvas.requestRenderAll();
  };
  fonts.addEventListener("loadingdone", refresh);
  return () => fonts.removeEventListener("loadingdone", refresh);
}

export function collectSlideTexts(json: unknown): string[] {
  if (typeof json !== "object" || json === null || !Array.isArray((json as { objects?: unknown }).objects)) return [];
  return (json as { objects: unknown[] }).objects.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const text = (item as { text?: unknown }).text;
    return typeof text === "string" ? [text] : [];
  });
}

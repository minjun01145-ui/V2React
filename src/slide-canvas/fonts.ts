import { cache, FabricText, Group, IText, type FabricObject, type StaticCanvas } from "fabric";
import { DEFAULT_FONT_FAMILY, FONT_CATALOG, type FontDefinition } from "../fonts/catalog.ts";
import { DEFAULT_FONT_WEIGHTS, loadFonts, onFontsLoaded } from "../fonts/loader.ts";

export const SLIDE_FONT_FAMILY = DEFAULT_FONT_FAMILY;

/** 슬라이드 글꼴 선택기 항목. 앱 전역 카탈로그(src/fonts)를 그대로 노출한다. */
export const SLIDE_FONTS = FONT_CATALOG.map((font) => ({ label: font.label, family: font.family, category: font.category, id: font.id }));

export type SlideFont = FontDefinition;

/** Canvas text does not trigger web-font loading; load the faces before measuring. */
export async function loadSlideFonts(texts: readonly string[], families: readonly string[] = [SLIDE_FONT_FAMILY], weights: readonly number[] = DEFAULT_FONT_WEIGHTS): Promise<void> {
  const sample = texts.join("");
  await loadFonts(families, sample, weights);
  // Includes family stacks and partial text styles, not only the default face.
  cache.clearFontCache();
}

/** Re-measure existing text when new font subsets/weights finish loading during editing. */
export function watchSlideFonts(canvas: StaticCanvas): () => void {
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
  return onFontsLoaded(refresh);
}

export function collectSlideTexts(json: unknown): string[] {
  const texts: string[] = [];
  const visit = (value: unknown): void => {
    if (typeof value !== "object" || value === null) return;
    if ("text" in value && typeof value.text === "string") texts.push(value.text);
    if ("objects" in value && Array.isArray(value.objects)) value.objects.forEach(visit);
  };
  visit(json);
  return texts;
}

/** Include nested groups and per-character font overrides in read-only/editor loads. */
export function collectSlideFontFamilies(json: unknown): string[] {
  const families = new Set<string>();
  const visit = (value: unknown): void => {
    if (typeof value !== "object" || value === null) return;
    if ("fontFamily" in value && typeof value.fontFamily === "string") families.add(value.fontFamily);
    Object.values(value).forEach(visit);
  };
  visit(json);
  return families.size ? [...families] : [SLIDE_FONT_FAMILY];
}

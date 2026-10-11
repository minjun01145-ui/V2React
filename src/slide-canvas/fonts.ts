import { cache, FabricText, Group, IText, type FabricObject, type StaticCanvas } from "fabric";

export const SLIDE_FONT_FAMILY = "'Noto Sans KR', sans-serif";

export const SLIDE_FONTS = [
  { label: "기본 고딕", family: SLIDE_FONT_FAMILY },
  { label: "프리텐다드", family: "'Pretendard', sans-serif" },
  { label: "본명조", family: "'Noto Serif KR', serif" },
  { label: "검은고딕", family: "'Black Han Sans', sans-serif" },
  { label: "주아", family: "'Jua', sans-serif" },
  { label: "나눔손글씨 펜", family: "'Nanum Pen Script', cursive" },
  { label: "궁서", family: "'ChosunGs', 'Gungsuh', '궁서', serif" },
] as const;

/** Canvas text does not trigger web-font loading; load the faces before measuring. */
export async function loadSlideFonts(texts: readonly string[], families: readonly string[] = [SLIDE_FONT_FAMILY]): Promise<void> {
  const sample = texts.join("");
  if (!sample || typeof document === "undefined" || !document.fonts) return;
  await Promise.all([...new Set(families)].flatMap((family) => [400, 700, 800].map((weight) =>
    document.fonts.load(`${weight} 32px ${family}`, sample),
  ))).catch(() => undefined);
  // Includes family stacks and partial text styles, not only the default face.
  cache.clearFontCache();
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

import { SLIDE_HEIGHT, SLIDE_WIDTH, type Slide } from "../slide-show/types.ts";

export type TemplateVariant = "cover" | "content";
export type TemplateDecoration =
  | { readonly kind: "rect"; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly color: string; readonly radius?: number; readonly opacity?: number }
  | { readonly kind: "circle"; readonly x: number; readonly y: number; readonly diameter: number; readonly color: string };
export interface TemplateText {
  readonly fontFamily: string;
  readonly color: string;
  readonly size: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly weight?: number;
  readonly align?: "left" | "center";
  readonly lineHeight?: number;
}
export interface TemplateLayout {
  readonly background: string;
  readonly decorations: readonly TemplateDecoration[];
  readonly title: TemplateText;
  readonly body: TemplateText;
}
export interface SlideTemplate {
  readonly id: string;
  readonly name: string;
  readonly cover: TemplateLayout;
  readonly content: TemplateLayout;
}
const PRETENDARD = "'Pretendard', sans-serif";
const JUA = "'Jua', sans-serif";

/** All dimensions are percentages; circles/radii/font sizes use slide height. */
export const SLIDE_TEMPLATES: readonly SlideTemplate[] = [
  {
    id: "classic-blue", name: "클래식 블루",
    content: {
      background: "#F7F8FC",
      decorations: [
        { kind: "rect", x: 0, y: 0, w: 1.6, h: 100, color: "#3B5BDB" },
        { kind: "rect", x: 7, y: 21, w: 10, h: 0.8, color: "#3B5BDB" },
        { kind: "rect", x: 92, y: 92, w: 4, h: 0.8, color: "#BAC8FF" },
      ],
      title: { fontFamily: PRETENDARD, color: "#1F2A44", size: 6.5, weight: 700, x: 7, y: 8, w: 86, h: 12 },
      body: { fontFamily: PRETENDARD, color: "#343A40", size: 3.6, x: 7, y: 27, w: 86, h: 60, lineHeight: 1.4 },
    },
    cover: {
      background: "#3B5BDB",
      decorations: [
        { kind: "circle", x: 88, y: 85, diameter: 45, color: "#4C6EF5" },
        { kind: "circle", x: 8, y: 10, diameter: 18, color: "#364FC7" },
        { kind: "rect", x: 40, y: 58, w: 20, h: 0.8, color: "#FFFFFF" },
      ],
      title: { fontFamily: PRETENDARD, color: "#FFFFFF", size: 9, weight: 700, align: "center", x: 10, y: 36, w: 80, h: 18 },
      body: { fontFamily: PRETENDARD, color: "#DBE4FF", size: 4, align: "center", x: 15, y: 63, w: 70, h: 10 },
    },
  },
  {
    id: "warm-note", name: "따뜻한 노트",
    content: {
      background: "#FFF8EC",
      decorations: [
        { kind: "circle", x: 96, y: 100, diameter: 40, color: "#FFE3BF" },
        { kind: "circle", x: 4, y: 4, diameter: 10, color: "#F4A259" },
        { kind: "rect", x: 7, y: 10.6, w: 34, h: 3.6, radius: 1.8, color: "#FFD43B", opacity: 0.55 },
      ],
      title: { fontFamily: JUA, color: "#5C3D2E", size: 6.5, x: 7, y: 7, w: 86, h: 12 },
      body: { fontFamily: PRETENDARD, color: "#4A3B32", size: 3.6, x: 7, y: 26, w: 86, h: 62, lineHeight: 1.45 },
    },
    cover: {
      background: "#F4A259",
      decorations: [
        { kind: "rect", x: 12, y: 20, w: 76, h: 60, radius: 2.5, color: "#FFF8EC" },
        { kind: "circle", x: 12, y: 20, diameter: 8, color: "#FFD43B" },
        { kind: "circle", x: 88, y: 80, diameter: 12, color: "#E8833A" },
      ],
      title: { fontFamily: JUA, color: "#5C3D2E", size: 8.5, align: "center", x: 16, y: 33, w: 68, h: 18 },
      body: { fontFamily: PRETENDARD, color: "#8A5A44", size: 3.8, align: "center", x: 16, y: 56, w: 68, h: 10 },
    },
  },
];

type CanvasObject = Record<string, unknown>;
function isObject(value: unknown): value is CanvasObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isText(object: CanvasObject): boolean {
  return typeof object.type === "string" && ["textbox", "i-text", "text"].includes(object.type.toLowerCase());
}
function placeholder(text: string, style: TemplateText): CanvasObject {
  return {
    type: "Textbox", originX: "left", originY: "top", text,
    left: style.x * SLIDE_WIDTH / 100, top: style.y * SLIDE_HEIGHT / 100,
    width: style.w * SLIDE_WIDTH / 100, height: style.h * SLIDE_HEIGHT / 100,
    fontFamily: style.fontFamily, fill: style.color, fontSize: style.size * SLIDE_HEIGHT / 100,
    fontWeight: style.weight ?? 400, textAlign: style.align ?? "left", lineHeight: style.lineHeight ?? 1.16,
    splitByGrapheme: true,
  };
}

/** Pure JSON cutover: only template decorations, background, font family and text ink change. */
export function applyTemplate(slide: Slide, template: SlideTemplate, { variant }: { readonly variant: TemplateVariant }): Slide {
  const canvas: unknown = JSON.parse(slide.canvas);
  if (!isObject(canvas) || (canvas.objects !== undefined && !Array.isArray(canvas.objects))) throw new Error("슬라이드 내용 형식이 올바르지 않습니다.");
  const layout = template[variant];
  const objects = ((canvas.objects ?? []) as unknown[]).filter((object) => !(isObject(object) && isObject(object.data) && object.data.templateDecoration === true));
  const texts: CanvasObject[] = [];
  const collect = (items: unknown[]): void => {
    for (const item of items) {
      if (!isObject(item)) continue;
      if (isText(item)) texts.push(item);
      if (Array.isArray(item.objects)) collect(item.objects);
    }
  };
  collect(objects);
  // Stable reduction keeps the first object for equal size/top values.
  const title = texts.reduce<CanvasObject | null>((best, text) => {
    const size = Number(text.fontSize ?? 40);
    const bestSize = Number(best?.fontSize ?? 40);
    return !best || size > bestSize || (size === bestSize && Number(text.top ?? 0) < Number(best.top ?? 0)) ? text : best;
  }, null);
  const restyle = (items: unknown[]): unknown[] => items.map((item) => {
    if (!isObject(item)) return item;
    let next = item;
    if (isText(item)) {
      const style = item === title ? layout.title : layout.body;
      // Override only ink/family in inline styles; bold, italics, size and other formatting survive.
      const styles = Array.isArray(item.styles) ? item.styles.map((run) => isObject(run) && isObject(run.style)
        ? { ...run, style: { ...run.style, fontFamily: style.fontFamily, fill: style.color } } : run)
        : isObject(item.styles) ? Object.fromEntries(Object.entries(item.styles).map(([line, chars]) => [line, isObject(chars)
          ? Object.fromEntries(Object.entries(chars).map(([char, props]) => [char, isObject(props) ? { ...props, fontFamily: style.fontFamily, fill: style.color } : props])) : chars])) : item.styles;
      next = { ...item, fontFamily: style.fontFamily, fill: style.color, ...(styles === undefined ? {} : { styles }) };
    }
    return Array.isArray(item.objects) ? { ...next, objects: restyle(item.objects) } : next;
  });
  const decorations = layout.decorations.map((shape): CanvasObject => {
    const common = { originX: "left", originY: "top", fill: shape.color, strokeWidth: 0, selectable: false, evented: false,
      lockMovementX: true, lockMovementY: true, lockScalingX: true, lockScalingY: true, lockRotation: true,
      data: { templateDecoration: true, templateId: template.id } };
    if (shape.kind === "circle") {
      const radius = shape.diameter * SLIDE_HEIGHT / 200;
      return { ...common, type: "Circle", left: shape.x * SLIDE_WIDTH / 100 - radius, top: shape.y * SLIDE_HEIGHT / 100 - radius, radius };
    }
    return { ...common, type: "Rect", left: shape.x * SLIDE_WIDTH / 100, top: shape.y * SLIDE_HEIGHT / 100,
      width: shape.w * SLIDE_WIDTH / 100, height: shape.h * SLIDE_HEIGHT / 100,
      rx: (shape.radius ?? 0) * SLIDE_HEIGHT / 100, ry: (shape.radius ?? 0) * SLIDE_HEIGHT / 100, opacity: shape.opacity ?? 1 };
  });
  const { backgroundImage: _backgroundImage, ...rest } = canvas;
  return { ...slide, canvas: JSON.stringify({ ...rest, background: layout.background, objects: [...decorations, ...restyle(objects),
    ...(texts.length ? [] : [placeholder("제목을 입력하세요", layout.title), placeholder(variant === "cover" ? "부제목을 입력하세요" : "내용을 입력하세요", layout.body)])] }) };
}

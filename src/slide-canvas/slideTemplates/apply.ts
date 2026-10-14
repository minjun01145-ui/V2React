import { SLIDE_HEIGHT, SLIDE_WIDTH, type Slide } from "../../slide-show/types.ts";
import type { SlideTemplate, TemplateText, TemplateVariant } from "./types.ts";

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

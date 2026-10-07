import { Circle, FabricImage, Line, Rect, Textbox, Triangle, type Canvas, type FabricObject } from "fabric";
import type { AssistantObject, AssistantOperation, AssistantSlide } from "../slide-assistant/types.ts";
import { SLIDE_HEIGHT, SLIDE_WIDTH } from "../slide-show/types.ts";
import { loadSlideFonts, SLIDE_FONT_FAMILY } from "./fonts.ts";

/** Bridges the slide AI helper and Fabric: describes objects for the AI and applies its edits. */

const DEFAULT_TEXT_COLOR = "#101a3a";
const DEFAULT_SHAPE_FILL = "#ffc933";
const DEFAULT_IMAGE_WIDTH = 420;
const MAX_DESCRIBED_TEXT = 200;

function hex(value: unknown): string | undefined {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : undefined;
}

function kindOf(object: FabricObject): AssistantObject["kind"] {
  if (object instanceof Textbox) return "text";
  if (object instanceof FabricImage) return "image";
  if (object instanceof Line) return "line";
  return "shape";
}

export function describeSlide(objects: readonly FabricObject[], background: string): AssistantSlide {
  return {
    background,
    objects: objects.map((object, index): AssistantObject => {
      const kind = kindOf(object);
      const base = {
        id: `o${index + 1}`, kind, z: index + 1,
        left: Math.round(object.left), top: Math.round(object.top),
        width: Math.round(object.getScaledWidth()), height: Math.round(object.getScaledHeight()),
      };
      if (object instanceof Textbox) {
        const background = hex(object.backgroundColor);
        return {
          ...base, text: object.text.slice(0, MAX_DESCRIBED_TEXT), fontSize: Math.round(object.fontSize),
          bold: Number(object.fontWeight) >= 700, textAlign: String(object.textAlign),
          ...(hex(object.fill) ? { fill: hex(object.fill)! } : {}), ...(background ? { background } : {}),
        };
      }
      const fill = kind === "shape" ? hex(object.fill) : kind === "line" ? hex(object.stroke) : undefined;
      return fill ? { ...base, fill } : base;
    }),
  };
}

function resize(target: FabricObject, width: number, height: number | undefined): void {
  if (target instanceof Textbox) {
    target.set({ width: width / target.scaleX });
  } else if (target instanceof FabricImage) {
    const scale = width / target.width;
    target.set({ scaleX: scale, scaleY: scale });
  } else {
    target.set({ scaleX: width / target.width, scaleY: (height ?? target.getScaledHeight()) / target.height });
  }
}

function style(target: FabricObject, operation: Extract<AssistantOperation, { op: "style" }>): void {
  if (operation.opacity !== undefined) target.set({ opacity: operation.opacity });
  if (operation.fill !== undefined) {
    if (target instanceof Line) target.set({ stroke: operation.fill });
    else if (!(target instanceof FabricImage)) target.set({ fill: operation.fill });
  }
  if (target instanceof Textbox) {
    if (operation.fontSize !== undefined) target.set({ fontSize: operation.fontSize });
    if (operation.bold !== undefined) target.set({ fontWeight: operation.bold ? 800 : 400 });
    if (operation.textAlign !== undefined) target.set({ textAlign: operation.textAlign });
    if (operation.background !== undefined) target.set({ backgroundColor: operation.background ?? "" });
  }
}

function shape(operation: Extract<AssistantOperation, { op: "addShape" }>): FabricObject {
  const common = { left: operation.left, top: operation.top, fill: operation.fill ?? DEFAULT_SHAPE_FILL, stroke: DEFAULT_TEXT_COLOR, strokeWidth: 0, strokeUniform: true };
  if (operation.shape === "circle") {
    return new Circle({ ...common, radius: operation.width / 2, scaleY: operation.height / operation.width });
  }
  if (operation.shape === "triangle") return new Triangle({ ...common, width: operation.width, height: operation.height });
  return new Rect({ ...common, width: operation.width, height: operation.height, rx: 16, ry: 16 });
}

async function image(operation: Extract<AssistantOperation, { op: "addImage" }>, loadImage: (query: string) => Promise<string>): Promise<FabricObject> {
  const picture = await FabricImage.fromURL(await loadImage(operation.query));
  const scale = Math.min((operation.width ?? DEFAULT_IMAGE_WIDTH) / picture.width, (SLIDE_HEIGHT * 0.9) / picture.height);
  picture.set({ scaleX: scale, scaleY: scale, strokeWidth: 0, stroke: DEFAULT_TEXT_COLOR, strokeUniform: true });
  picture.set({
    left: operation.left ?? SLIDE_WIDTH - picture.getScaledWidth() - 60,
    top: operation.top ?? (SLIDE_HEIGHT - picture.getScaledHeight()) / 2,
  });
  return picture;
}

/**
 * Applies one operation. `target` is the object the operation's id referred to when the slide
 * was described; returns false when it no longer exists or the operation does not fit it.
 */
export async function applyAssistantOperation(
  canvas: Canvas,
  operation: AssistantOperation,
  target: FabricObject | undefined,
  loadImage: (query: string) => Promise<string>,
): Promise<boolean> {
  if ("id" in operation && (!target || !canvas.getObjects().includes(target))) return false;
  switch (operation.op) {
    case "move": target!.set({ left: operation.left, top: operation.top }); break;
    case "resize": resize(target!, operation.width, operation.height); break;
    case "style": style(target!, operation); break;
    case "setText":
      if (!(target instanceof Textbox)) return false;
      await loadSlideFonts([operation.text]);
      target.set({ text: operation.text });
      break;
    case "delete": canvas.remove(target!); return true;
    case "addText": {
      await loadSlideFonts([operation.text]);
      canvas.add(new Textbox(operation.text, {
        left: operation.left, top: operation.top, width: operation.width, fontSize: operation.fontSize ?? 40,
        fontWeight: operation.bold ? 800 : 400, fontFamily: SLIDE_FONT_FAMILY, fill: operation.fill ?? DEFAULT_TEXT_COLOR,
        textAlign: operation.textAlign ?? "left", backgroundColor: operation.background ?? "", splitByGrapheme: true,
      }));
      return true;
    }
    case "addShape": canvas.add(shape(operation)); return true;
    case "addImage": canvas.add(await image(operation, loadImage)); return true;
    case "background": canvas.backgroundColor = operation.color; return true;
  }
  target!.setCoords();
  return true;
}

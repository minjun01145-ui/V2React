import "./fabricSetup.ts";
import { Canvas, Circle, FabricImage, Line, Rect, Textbox, Triangle, type FabricObject } from "fabric";
import { SLIDE_HEIGHT, SLIDE_WIDTH, type SlideFrame } from "../slide-show/types.ts";
import { collectSlideTexts, loadSlideFonts, SLIDE_FONT_FAMILY } from "./fonts.ts";

export type SlideShapeKind = "rect" | "circle" | "triangle" | "line";
export type SlideObjectKind = "text" | "shape" | "line" | "image" | "engine";
export type SlideArrangeAction = "front" | "forward" | "backward" | "back";

/** Editable properties of the selected object, in the form the property panel shows them. */
export interface SlideObjectStyle {
  readonly kind: SlideObjectKind;
  readonly fill: string;
  readonly opacity: number;
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly fontSize: number;
  readonly bold: boolean;
}

export type SlideObjectStylePatch = Partial<Omit<SlideObjectStyle, "kind">>;

interface ControllerEvents {
  readonly onChange: () => void;
  readonly onSelectionChange: (style: SlideObjectStyle | null) => void;
}

const DEFAULT_TEXT_COLOR = "#101a3a";
const DEFAULT_SHAPE_FILL = "#ffc933";
const DEFAULT_STROKE = "#101a3a";
const ENGINE_FRAME_COLOR = "#2338b8";

export function emptySlideCanvas(background = "#ffffff"): string {
  return JSON.stringify({ objects: [], background });
}

function hexColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

/**
 * Wraps a Fabric canvas with the handful of slide-editing operations the editor UI needs.
 * The engine window is a regular Fabric rectangle excluded from export, so it can be
 * moved and resized like any object but is saved separately as the slide's engine frame.
 */
export class SlideEditorController {
  private readonly canvas: Canvas;
  private readonly events: ControllerEvents;
  private engineFrame: Rect | null = null;
  private engineLabel = "";
  private loading = false;

  constructor(element: HTMLCanvasElement, events: ControllerEvents) {
    this.events = events;
    this.canvas = new Canvas(element, { preserveObjectStacking: true, selectionColor: "rgba(35,56,184,.08)", selectionBorderColor: ENGINE_FRAME_COLOR });
    const changed = (): void => { if (!this.loading) this.events.onChange(); };
    const selection = (): void => this.events.onSelectionChange(this.selectedStyle());
    this.canvas.on("object:added", changed);
    this.canvas.on("object:removed", changed);
    this.canvas.on("text:changed", changed);
    this.canvas.on("object:modified", ({ target }) => {
      if (target === this.engineFrame) this.normalizeEngineFrame();
      changed();
      selection();
    });
    this.canvas.on("selection:created", selection);
    this.canvas.on("selection:updated", selection);
    this.canvas.on("selection:cleared", selection);
    this.canvas.on("after:render", ({ ctx }) => this.drawEngineLabel(ctx));
  }

  dispose(): Promise<boolean> {
    return this.canvas.dispose();
  }

  resize(displayWidth: number): void {
    const width = Math.max(1, Math.floor(displayWidth));
    this.canvas.setDimensions({ width, height: Math.round(width * SLIDE_HEIGHT / SLIDE_WIDTH) });
    this.canvas.setZoom(width / SLIDE_WIDTH);
    this.canvas.requestRenderAll();
  }

  async load(canvasJson: string, frame: SlideFrame | null, engineLabel: string): Promise<void> {
    this.loading = true;
    try {
      const parsed: unknown = JSON.parse(canvasJson);
      await loadSlideFonts(collectSlideTexts(parsed));
      this.engineFrame = null;
      await this.canvas.loadFromJSON(parsed as Record<string, unknown>);
      this.engineLabel = engineLabel;
      if (frame) this.placeEngineFrame(frame);
      this.canvas.discardActiveObject();
      this.canvas.requestRenderAll();
    } finally {
      this.loading = false;
    }
    this.events.onSelectionChange(null);
  }

  serialize(): string {
    return JSON.stringify(this.canvas.toObject());
  }

  get background(): string {
    return hexColor(this.canvas.backgroundColor, "#ffffff");
  }

  setBackground(color: string): void {
    this.canvas.backgroundColor = color;
    this.canvas.requestRenderAll();
    this.events.onChange();
  }

  addText(): void {
    const text = new Textbox("텍스트를 입력하세요", {
      left: 160, top: 120, width: 640, fontSize: 48, fontWeight: 700,
      fontFamily: SLIDE_FONT_FAMILY, fill: DEFAULT_TEXT_COLOR, splitByGrapheme: true,
    });
    this.addAndSelect(text);
    text.enterEditing();
    text.selectAll();
  }

  addShape(kind: SlideShapeKind): void {
    const common = { left: 480, top: 220, fill: DEFAULT_SHAPE_FILL, stroke: DEFAULT_STROKE, strokeWidth: 0, strokeUniform: true };
    const shape = kind === "rect" ? new Rect({ ...common, width: 320, height: 200, rx: 16, ry: 16 })
      : kind === "circle" ? new Circle({ ...common, radius: 120 })
      : kind === "triangle" ? new Triangle({ ...common, width: 260, height: 220 })
      : new Line([0, 0, 360, 0], { left: 460, top: 360, stroke: DEFAULT_STROKE, strokeWidth: 8, strokeUniform: true });
    this.addAndSelect(shape);
  }

  async addImage(dataUrl: string): Promise<void> {
    const image = await FabricImage.fromURL(dataUrl);
    const scale = Math.min(1, (SLIDE_WIDTH * 0.6) / image.width, (SLIDE_HEIGHT * 0.6) / image.height);
    image.set({ scaleX: scale, scaleY: scale, strokeWidth: 0, stroke: DEFAULT_STROKE, strokeUniform: true });
    image.set({ left: (SLIDE_WIDTH - image.getScaledWidth()) / 2, top: (SLIDE_HEIGHT - image.getScaledHeight()) / 2 });
    this.addAndSelect(image);
  }

  deleteSelection(): void {
    const targets = this.canvas.getActiveObjects().filter((item) => item !== this.engineFrame && !(item instanceof Textbox && item.isEditing));
    if (targets.length === 0) return;
    this.canvas.discardActiveObject();
    this.canvas.remove(...targets);
    this.canvas.requestRenderAll();
  }

  arrange(action: SlideArrangeAction): void {
    const target = this.canvas.getActiveObject();
    if (!target) return;
    if (action === "front") this.canvas.bringObjectToFront(target);
    else if (action === "forward") this.canvas.bringObjectForward(target);
    else if (action === "backward") this.canvas.sendObjectBackwards(target);
    else this.canvas.sendObjectToBack(target);
    this.canvas.requestRenderAll();
    this.events.onChange();
  }

  updateSelection(patch: SlideObjectStylePatch): void {
    const target = this.canvas.getActiveObject();
    if (!target || target === this.engineFrame) return;
    const kind = this.kindOf(target);
    if (patch.opacity !== undefined) target.set({ opacity: patch.opacity });
    if (patch.fill !== undefined && kind !== "line" && kind !== "image") target.set({ fill: patch.fill });
    if (patch.stroke !== undefined && kind !== "text") target.set({ stroke: patch.stroke });
    if (patch.strokeWidth !== undefined && kind !== "text") target.set({ strokeWidth: patch.strokeWidth });
    if (target instanceof Textbox) {
      if (patch.fontSize !== undefined) target.set({ fontSize: patch.fontSize });
      if (patch.bold !== undefined) target.set({ fontWeight: patch.bold ? 800 : 400 });
    }
    target.setCoords();
    this.canvas.requestRenderAll();
    this.events.onChange();
    this.events.onSelectionChange(this.selectedStyle());
  }

  /** The engine frame in slide units, or null when the slide has no engine. */
  getEngineFrame(): SlideFrame | null {
    const frame = this.engineFrame;
    if (!frame) return null;
    return { x: frame.left, y: frame.top, width: frame.width * frame.scaleX, height: frame.height * frame.scaleY };
  }

  setEngineFrame(frame: SlideFrame | null, label: string): void {
    this.engineLabel = label;
    if (this.engineFrame) {
      this.canvas.remove(this.engineFrame);
      this.engineFrame = null;
    }
    if (frame) {
      this.placeEngineFrame(frame);
      this.canvas.setActiveObject(this.engineFrame!);
    }
    this.canvas.requestRenderAll();
    this.events.onChange();
  }

  setEngineLabel(label: string): void {
    this.engineLabel = label;
    this.canvas.requestRenderAll();
  }

  /** Deletes the selection with the Delete key unless a text box is being edited. */
  handleKeyDown(event: KeyboardEvent): void {
    if (event.key !== "Delete" && event.key !== "Backspace") return;
    const active = this.canvas.getActiveObject();
    if (!active || (active instanceof Textbox && active.isEditing)) return;
    event.preventDefault();
    this.deleteSelection();
  }

  private addAndSelect(object: FabricObject): void {
    this.canvas.add(object);
    this.canvas.setActiveObject(object);
    this.canvas.requestRenderAll();
  }

  private placeEngineFrame(frame: SlideFrame): void {
    const rect = new Rect({
      left: frame.x, top: frame.y, width: frame.width, height: frame.height,
      fill: "rgba(35,56,184,0.10)", stroke: ENGINE_FRAME_COLOR, strokeWidth: 3, strokeDashArray: [14, 10],
      strokeUniform: true, lockRotation: true, excludeFromExport: true, objectCaching: false,
    });
    rect.setControlsVisibility({ mtr: false });
    this.engineFrame = rect;
    // Behind the slide content so it never blocks selecting text or shapes; the label is drawn on top.
    this.canvas.add(rect);
    this.canvas.sendObjectToBack(rect);
  }

  /** Keep the stored frame free of scale so resizing never distorts the dashed border. */
  private normalizeEngineFrame(): void {
    const frame = this.engineFrame;
    if (!frame) return;
    frame.set({ width: frame.width * frame.scaleX, height: frame.height * frame.scaleY, scaleX: 1, scaleY: 1 });
    frame.setCoords();
  }

  private drawEngineLabel(ctx: CanvasRenderingContext2D): void {
    const frame = this.engineFrame;
    if (!frame) return;
    const [a, b, c, d, e, f] = this.canvas.viewportTransform;
    ctx.save();
    ctx.transform(a, b, c, d, e, f);
    ctx.font = `800 28px ${SLIDE_FONT_FAMILY}`;
    ctx.fillStyle = ENGINE_FRAME_COLOR;
    ctx.textBaseline = "top";
    ctx.fillText(this.engineLabel ? `문제 엔진 · ${this.engineLabel}` : "문제 엔진", frame.left + 18, frame.top + 16);
    ctx.restore();
  }

  private kindOf(target: FabricObject): SlideObjectKind {
    if (target === this.engineFrame) return "engine";
    if (target instanceof Textbox) return "text";
    if (target instanceof FabricImage) return "image";
    if (target instanceof Line) return "line";
    return "shape";
  }

  private selectedStyle(): SlideObjectStyle | null {
    const target = this.canvas.getActiveObject();
    if (!target) return null;
    return {
      kind: this.kindOf(target),
      fill: hexColor(target.fill, target instanceof Textbox ? DEFAULT_TEXT_COLOR : DEFAULT_SHAPE_FILL),
      opacity: target.opacity,
      stroke: hexColor(target.stroke, DEFAULT_STROKE),
      strokeWidth: target.strokeWidth,
      fontSize: target instanceof Textbox ? target.fontSize : 0,
      bold: target instanceof Textbox ? Number(target.fontWeight) >= 700 || target.fontWeight === "bold" : false,
    };
  }
}

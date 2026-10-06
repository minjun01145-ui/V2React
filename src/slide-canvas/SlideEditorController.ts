import "./fabricSetup.ts";
import { Canvas, Circle, Control, controlsUtils, FabricImage, Line, Rect, Textbox, Triangle, type FabricObject } from "fabric";
import { SLIDE_HEIGHT, SLIDE_WIDTH, type SlideFrame } from "../slide-show/types.ts";
import { collectSlideTexts, loadSlideFonts, SLIDE_FONT_FAMILY } from "./fonts.ts";
import { UndoHistory } from "./undoHistory.ts";

export type SlideShapeKind = "rect" | "circle" | "triangle" | "line";
export type SlideObjectKind = "text" | "shape" | "line" | "image" | "engine";
export type SlideArrangeAction = "front" | "forward" | "backward" | "back";
export type SlideTextAlign = "left" | "center" | "right";

/** Editable properties of the selected object, in the form the property panel shows them. */
export interface SlideObjectStyle {
  readonly kind: SlideObjectKind;
  readonly fill: string;
  readonly opacity: number;
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly fontSize: number;
  readonly bold: boolean;
  readonly textAlign: SlideTextAlign;
}

export type SlideObjectStylePatch = Partial<Omit<SlideObjectStyle, "kind">>;

interface ControllerEvents {
  readonly onChange: () => void;
  readonly onSelectionChange: (style: SlideObjectStyle | null) => void;
  /** The engine window is saved with the slide, so the editor removes it rather than the canvas. */
  readonly onEngineDelete: () => void;
}

const DEFAULT_TEXT_COLOR = "#101a3a";
const DEFAULT_SHAPE_FILL = "#ffc933";
const DEFAULT_STROKE = "#101a3a";
const SELECTION_COLOR = "#2338b8";
const ENGINE_ACCENT = "#ffc933";
const ENGINE_ACCENT_DEEP = "#d49b00";
const ENGINE_INK = "#1a1640";

export function emptySlideCanvas(background = "#ffffff"): string {
  return JSON.stringify({ objects: [], background });
}

function hexColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function textAlignOf(value: unknown): SlideTextAlign {
  return value === "center" || value === "right" ? value : "left";
}

function renderMoveGrip(ctx: CanvasRenderingContext2D, left: number, top: number): void {
  ctx.save();
  ctx.translate(left, top);
  ctx.fillStyle = SELECTION_COLOR;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    ctx.moveTo(0, 0);
    ctx.lineTo(dx * 8, dy * 8);
    ctx.moveTo(dx * 8 - dy * 3 - dx * 3, dy * 8 - dx * 3 - dy * 3);
    ctx.lineTo(dx * 8, dy * 8);
    ctx.lineTo(dx * 8 + dy * 3 - dx * 3, dy * 8 + dx * 3 - dy * 3);
  }
  ctx.stroke();
  ctx.restore();
}

/** A grip under a text box that drags it, also while its text is being edited (where dragging selects text). */
const MOVE_GRIP = new Control({
  x: 0, y: 0.5, offsetY: 30, sizeX: 30, sizeY: 30, cursorStyle: "move", actionName: "drag",
  actionHandler: controlsUtils.dragHandler, render: renderMoveGrip,
});

/**
 * A text box grows by width (side handles) or by font size (corners); it never stretches its glyphs,
 * and it can always be moved with its grip.
 */
function prepareTextbox(text: Textbox): void {
  text.controls = { ...text.controls, moveGrip: MOVE_GRIP };
  text.setControlsVisibility({ mt: false, mb: false });
}

/** Turns a corner drag (a scale) into a larger font and wider box, so the text stays crisp and unstretched. */
function bakeTextboxScale(text: Textbox): void {
  if (text.scaleX === 1 && text.scaleY === 1) return;
  text.set({ fontSize: Math.max(8, Math.round(text.fontSize * text.scaleY)), width: text.width * text.scaleX, scaleX: 1, scaleY: 1 });
  text.setCoords();
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
  /** Slide content only; the engine window belongs to the slide's engine settings, not to undo. */
  private readonly history = new UndoHistory<string>();
  private restoring = false;
  private recordScheduled = false;

  constructor(element: HTMLCanvasElement, events: ControllerEvents) {
    this.events = events;
    this.canvas = new Canvas(element, { preserveObjectStacking: true, selectionColor: "rgba(35,56,184,.08)", selectionBorderColor: SELECTION_COLOR });
    const changed = (): void => { if (!this.loading && !this.restoring) this.edited(); };
    const selection = (): void => this.events.onSelectionChange(this.selectedStyle());
    this.canvas.on("object:added", ({ target }) => {
      if (target instanceof Textbox) prepareTextbox(target);
      if (target !== this.engineFrame) this.keepEngineFrameOnTop();
      changed();
    });
    this.canvas.on("object:removed", changed);
    // Typing saves the slide as it goes but becomes one undo step when editing ends.
    this.canvas.on("text:changed", () => { if (!this.loading && !this.restoring) this.events.onChange(); });
    this.canvas.on("text:editing:exited", changed);
    // Fabric hides the handles and locks a text box while editing; keep it resizable and movable.
    // (Assigned directly: Fabric's set() during editing only changes the values restored on exit.)
    this.canvas.on("text:editing:entered", ({ target }) => {
      target.hasControls = true;
      target.lockMovementX = false;
      target.lockMovementY = false;
      this.canvas.requestRenderAll();
    });
    this.canvas.on("object:modified", ({ target }) => {
      if (target === this.engineFrame) this.normalizeEngineFrame();
      if (target instanceof Textbox) bakeTextboxScale(target);
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
      this.history.reset(this.serialize());
    } finally {
      this.loading = false;
    }
    this.events.onSelectionChange(null);
  }

  undo(): Promise<void> {
    return this.step("undo");
  }

  redo(): Promise<void> {
    return this.step("redo");
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
    this.edited();
  }

  addText(): void {
    const text = new Textbox("텍스트를 입력하세요", {
      left: 160, top: 120, width: 640, fontSize: 48, fontWeight: 400,
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
    this.keepEngineFrameOnTop();
    this.canvas.requestRenderAll();
    this.edited();
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
      if (patch.textAlign !== undefined) target.set({ textAlign: patch.textAlign });
    }
    target.setCoords();
    this.canvas.requestRenderAll();
    this.edited();
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

  /**
   * Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y undo and redo (matched by key position, so they also work
   * with the Korean keyboard layout). Delete removes the selection unless text is being edited.
   */
  handleKeyDown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && (event.code === "KeyZ" || event.code === "KeyY")) {
      event.preventDefault();
      void (event.code === "KeyY" || event.shiftKey ? this.redo() : this.undo());
      return;
    }
    if (event.key !== "Delete" && event.key !== "Backspace") return;
    const active = this.canvas.getActiveObject();
    if (!active || (active instanceof Textbox && active.isEditing)) return;
    event.preventDefault();
    if (active === this.engineFrame) this.events.onEngineDelete();
    else this.deleteSelection();
  }

  /** Every user edit: save the slide and record one undo step (several events of one action collapse). */
  private edited(): void {
    this.events.onChange();
    if (this.recordScheduled) return;
    this.recordScheduled = true;
    queueMicrotask(() => {
      this.recordScheduled = false;
      if (!this.loading && !this.restoring) this.history.push(this.serialize());
    });
  }

  private async step(direction: "undo" | "redo"): Promise<void> {
    if (this.loading || this.restoring) return;
    // Finish a text edit first so it becomes the latest step, then capture anything not yet recorded.
    const active = this.canvas.getActiveObject();
    if (active instanceof Textbox && active.isEditing) active.exitEditing();
    this.history.push(this.serialize());
    const snapshot = direction === "undo" ? this.history.undo() : this.history.redo();
    if (snapshot === null) return;
    this.restoring = true;
    const frame = this.getEngineFrame();
    try {
      this.engineFrame = null;
      await this.canvas.loadFromJSON(JSON.parse(snapshot) as Record<string, unknown>);
      if (frame) this.placeEngineFrame(frame);
      this.canvas.discardActiveObject();
      this.canvas.requestRenderAll();
    } finally {
      this.restoring = false;
    }
    this.events.onChange();
    this.events.onSelectionChange(null);
  }

  private addAndSelect(object: FabricObject): void {
    this.canvas.add(object);
    this.canvas.setActiveObject(object);
    this.canvas.requestRenderAll();
  }

  private placeEngineFrame(frame: SlideFrame): void {
    const rect = new Rect({
      left: frame.x, top: frame.y, width: frame.width, height: frame.height,
      fill: "rgba(255,226,140,0.92)", stroke: ENGINE_ACCENT_DEEP, strokeWidth: 4, strokeDashArray: [16, 10], rx: 18, ry: 18,
      strokeUniform: true, lockRotation: true, excludeFromExport: true, objectCaching: false,
    });
    rect.setControlsVisibility({ mtr: false });
    this.engineFrame = rect;
    // Above the slide content, as the live engine window covers the slide, so it is always grabbable.
    this.canvas.add(rect);
  }

  private keepEngineFrameOnTop(): void {
    if (this.engineFrame) this.canvas.bringObjectToFront(this.engineFrame);
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
    const label = `⚡ ${this.engineLabel ? `문제 엔진 · ${this.engineLabel}` : "문제 엔진"}`;
    ctx.font = `400 28px ${SLIDE_FONT_FAMILY}`;
    ctx.textBaseline = "middle";
    const width = ctx.measureText(label).width + 36;
    ctx.fillStyle = ENGINE_ACCENT_DEEP;
    ctx.beginPath();
    ctx.roundRect(frame.left + 16, frame.top + 20, width, 48, 24);
    ctx.fill();
    ctx.fillStyle = ENGINE_ACCENT;
    ctx.beginPath();
    ctx.roundRect(frame.left + 16, frame.top + 16, width, 48, 24);
    ctx.fill();
    ctx.fillStyle = ENGINE_INK;
    ctx.fillText(label, frame.left + 34, frame.top + 41);
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
      textAlign: target instanceof Textbox ? textAlignOf(target.textAlign) : "left",
    };
  }
}

import { SLIDE_HEIGHT, SLIDE_WIDTH } from "../slide-show/types.ts";
import { SLIDE_FONT_FAMILY } from "./fonts.ts";
import { encodeSlideImage } from "./imageFile.ts";

/*
 * Converts a .pptx file into slide canvases. Only the slides' own elements are kept:
 * text (content, size, colour, bold, alignment), basic shapes, lines, pictures and the
 * background colour. Fonts, animations, transitions, tables and charts are ignored.
 */

const NOT_PPTX = "PPTX 파일을 읽지 못했습니다.";
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const EMU_PER_POINT = 12700;
const DEFAULT_FONT_SIZE = 1800;
const IMAGE_TYPES: Readonly<Record<string, string>> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp" };
const IMAGE_OVERSAMPLE = 1.5;

// ---- zip ----

interface ZipEntry {
  readonly method: number;
  readonly offset: number;
  readonly size: number;
}

function readZipDirectory(bytes: Uint8Array<ArrayBuffer>): Map<string, ZipEntry> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end -= 1;
  if (end < 0) throw new Error(NOT_PPTX);
  const count = view.getUint16(end + 10, true);
  let position = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const entries = new Map<string, ZipEntry>();
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(position, true) !== 0x02014b50) throw new Error(NOT_PPTX);
    const nameLength = view.getUint16(position + 28, true);
    const local = view.getUint32(position + 42, true);
    if (view.getUint32(local, true) !== 0x04034b50) throw new Error(NOT_PPTX);
    entries.set(decoder.decode(bytes.subarray(position + 46, position + 46 + nameLength)), {
      method: view.getUint16(position + 10, true),
      size: view.getUint32(position + 20, true),
      offset: local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true),
    });
    position += 46 + nameLength + view.getUint16(position + 30, true) + view.getUint16(position + 32, true);
  }
  return entries;
}

class PptxPackage {
  private readonly bytes: Uint8Array<ArrayBuffer>;
  private readonly entries: Map<string, ZipEntry>;
  private readonly xmlCache = new Map<string, Promise<Element | null>>();

  constructor(bytes: Uint8Array<ArrayBuffer>) {
    this.bytes = bytes;
    try {
      this.entries = readZipDirectory(bytes);
    } catch {
      throw new Error(NOT_PPTX);
    }
  }

  async read(path: string): Promise<Uint8Array<ArrayBuffer> | null> {
    const entry = this.entries.get(path);
    if (!entry) return null;
    const data = this.bytes.slice(entry.offset, entry.offset + entry.size);
    if (entry.method === 0) return data;
    if (entry.method !== 8) return null;
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  xml(path: string): Promise<Element | null> {
    let cached = this.xmlCache.get(path);
    if (!cached) {
      cached = this.read(path).then((data) => {
        if (!data) return null;
        const document = new DOMParser().parseFromString(new TextDecoder().decode(data), "application/xml");
        return document.getElementsByTagName("parsererror").length > 0 ? null : document.documentElement;
      });
      this.xmlCache.set(path, cached);
    }
    return cached;
  }

  /** Relationship id → { type, absolute part path } for a part. */
  async rels(path: string): Promise<Map<string, { readonly type: string; readonly target: string }>> {
    const slash = path.lastIndexOf("/");
    const root = await this.xml(`${path.slice(0, slash)}/_rels/${path.slice(slash + 1)}.rels`);
    const result = new Map<string, { readonly type: string; readonly target: string }>();
    for (const rel of root ? children(root, "Relationship") : []) {
      const target = rel.getAttribute("Target") ?? "";
      if (rel.getAttribute("TargetMode") === "External") continue;
      result.set(rel.getAttribute("Id") ?? "", { type: rel.getAttribute("Type") ?? "", target: resolvePath(path.slice(0, slash), target) });
    }
    return result;
  }
}

function resolvePath(baseDir: string, target: string): string {
  const parts = target.startsWith("/") ? [] : baseDir.split("/");
  for (const part of target.split("/")) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }
  return parts.join("/");
}

// ---- xml helpers ----

function children(element: Element | null | undefined, name: string): Element[] {
  return element ? Array.from(element.children).filter((item) => item.localName === name) : [];
}

function child(element: Element | null | undefined, name: string): Element | null {
  return children(element, name)[0] ?? null;
}

function path(element: Element | null | undefined, ...names: string[]): Element | null {
  let current = element ?? null;
  for (const name of names) current = child(current, name);
  return current;
}

function numberAttr(element: Element | null | undefined, name: string): number | null {
  const value = element?.getAttribute(name);
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function boolAttr(element: Element | null | undefined, name: string): boolean | null {
  const value = element?.getAttribute(name);
  return value === "1" || value === "true" ? true : value === "0" || value === "false" ? false : null;
}

// ---- colours ----

type ColorMap = ReadonlyMap<string, string>;

function hex(value: number): string {
  return Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0");
}

function applyLuminance(color: string, mod: number, off: number): string {
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  const lum = Math.min(1, Math.max(0, l * mod + off));
  if (s === 0) return `#${hex(lum * 255).repeat(3)}`;
  const q = lum < 0.5 ? lum * (1 + s) : lum + s - lum * s;
  const p = 2 * lum - q;
  const channel = (t: number): number => {
    const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return `#${hex(channel(h + 1 / 3) * 255)}${hex(channel(h) * 255)}${hex(channel(h - 1 / 3) * 255)}`;
}

interface Color {
  readonly color: string;
  readonly alpha: number;
}

/** Reads a colour element (srgbClr, schemeClr, …) with its luminance and alpha modifiers. */
function readColor(node: Element | null, colors: ColorMap): Color | null {
  if (!node) return null;
  let color: string | null = null;
  const value = node.getAttribute("val") ?? "";
  if (node.localName === "srgbClr") color = `#${value}`;
  else if (node.localName === "schemeClr") color = colors.get(value) ?? null;
  else if (node.localName === "sysClr") color = `#${node.getAttribute("lastClr") ?? (value === "window" ? "FFFFFF" : "000000")}`;
  else if (node.localName === "prstClr") color = value === "white" ? "#ffffff" : value === "black" ? "#000000" : null;
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return null;
  const mod = numberAttr(child(node, "lumMod"), "val");
  const off = numberAttr(child(node, "lumOff"), "val");
  if (mod !== null || off !== null) color = applyLuminance(color, (mod ?? 100000) / 100000, (off ?? 0) / 100000);
  const alpha = numberAttr(child(node, "alpha"), "val");
  return { color: color.toLowerCase(), alpha: alpha === null ? 1 : alpha / 100000 };
}

/** Colour of a fill (solid, or the first stop of a gradient); null for none/unknown, undefined when not specified. */
function readFill(parent: Element | null, colors: ColorMap): Color | null | undefined {
  if (!parent) return undefined;
  if (child(parent, "noFill")) return null;
  const solid = child(parent, "solidFill");
  if (solid) return readColor(solid.firstElementChild, colors);
  const gradient = path(parent, "gradFill", "gsLst");
  if (gradient) return readColor(child(gradient, "gs")?.firstElementChild ?? null, colors);
  return undefined;
}

// ---- layout ----

interface Transform {
  readonly sx: number;
  readonly sy: number;
  readonly dx: number;
  readonly dy: number;
}

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly angle: number;
  readonly flipH: boolean;
  readonly flipV: boolean;
}

function readXfrm(xfrm: Element | null, transform: Transform): Box | null {
  const off = child(xfrm, "off");
  const ext = child(xfrm, "ext");
  if (!off || !ext) return null;
  return {
    x: (numberAttr(off, "x") ?? 0) * transform.sx + transform.dx,
    y: (numberAttr(off, "y") ?? 0) * transform.sy + transform.dy,
    width: (numberAttr(ext, "cx") ?? 0) * transform.sx,
    height: (numberAttr(ext, "cy") ?? 0) * transform.sy,
    angle: (numberAttr(xfrm, "rot") ?? 0) / 60000,
    flipH: boolAttr(xfrm, "flipH") === true,
    flipV: boolAttr(xfrm, "flipV") === true,
  };
}

/** Top-left position of a point inside a box after the box is rotated about its centre. */
function rotatedOrigin(box: Box, x: number, y: number): { readonly left: number; readonly top: number } {
  if (!box.angle) return { left: x, top: y };
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const radians = box.angle * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { left: cx + (x - cx) * cos - (y - cy) * sin, top: cy + (x - cx) * sin + (y - cy) * cos };
}

interface Placeholder {
  readonly type: string;
  readonly idx: string | null;
}

function placeholderOf(element: Element): Placeholder | null {
  const ph = path(element.firstElementChild, "nvPr", "ph");
  return ph ? { type: ph.getAttribute("type") ?? "obj", idx: ph.getAttribute("idx") } : null;
}

const TITLE_TYPES = new Set(["title", "ctrTitle"]);

function findPlaceholder(tree: Element | null, wanted: Placeholder, byTypeOnly: boolean): Element | null {
  if (!tree) return null;
  const candidates = Array.from(tree.getElementsByTagNameNS("*", "sp")).filter((item) => placeholderOf(item));
  const sameType = (item: Element): boolean => {
    const type = placeholderOf(item)!.type;
    return type === wanted.type || (TITLE_TYPES.has(type) && TITLE_TYPES.has(wanted.type)) || (!TITLE_TYPES.has(type) && !TITLE_TYPES.has(wanted.type) && type === "body" && ["obj", "subTitle"].includes(wanted.type));
  };
  if (!byTypeOnly && wanted.idx !== null) {
    const byIdx = candidates.find((item) => placeholderOf(item)!.idx === wanted.idx);
    if (byIdx) return byIdx;
  }
  return candidates.find((item) => placeholderOf(item)!.type === wanted.type) ?? candidates.find(sameType) ?? null;
}

interface SlideContext {
  readonly pkg: PptxPackage;
  readonly colors: ColorMap;
  readonly layoutTree: Element | null;
  readonly masterTree: Element | null;
  readonly master: Element | null;
  readonly defaultTextStyle: Element | null;
  readonly rels: Map<string, { readonly type: string; readonly target: string }>;
  readonly scale: number;
}

/** The slide element followed by the layout and master placeholders it inherits from. */
function inheritanceChain(element: Element, context: SlideContext): Element[] {
  const ph = placeholderOf(element);
  if (!ph) return [element];
  return [element, findPlaceholder(context.layoutTree, ph, false), findPlaceholder(context.masterTree, ph, true)].filter((item): item is Element => item !== null);
}

// ---- text ----

interface TextStyle {
  readonly size: number;
  readonly bold: boolean;
  readonly color: Color;
  readonly align: "left" | "center" | "right" | "justify";
}

const ALIGNMENTS: Readonly<Record<string, TextStyle["align"]>> = { l: "left", ctr: "center", r: "right", just: "justify", dist: "justify" };

function textOf(body: Element): string {
  return children(body, "p").map((paragraph) => Array.from(paragraph.children).map((item) => {
    if (item.localName === "br") return "\n";
    if (item.localName === "r" || item.localName === "fld") return child(item, "t")?.textContent ?? "";
    return "";
  }).join("")).join("\n").replace(/\s+$/, "");
}

function readTextStyle(body: Element, chain: readonly Element[], element: Element, context: SlideContext): TextStyle {
  const firstParagraph = children(body, "p").find((paragraph) => children(paragraph, "r").length > 0) ?? child(body, "p");
  const firstRun = path(child(firstParagraph, "r"), "rPr");
  const ph = placeholderOf(element);
  const masterStyle = path(context.master, "txStyles", !ph ? "otherStyle" : TITLE_TYPES.has(ph.type) ? "titleStyle" : "bodyStyle");
  const levelOne = [
    ...chain.map((item) => path(item, "txBody", "lstStyle", "lvl1pPr")),
    ph ? path(masterStyle, "lvl1pPr") : path(context.defaultTextStyle, "lvl1pPr"),
  ];
  const runProps = [firstRun, ...levelOne.map((item) => child(item, "defRPr"))];
  const first = <T>(read: (item: Element | null) => T | null | undefined, items = runProps): T | null => {
    for (const item of items) {
      const value = read(item);
      if (value !== null && value !== undefined) return value;
    }
    return null;
  };
  const fontScale = numberAttr(path(body, "bodyPr", "normAutofit"), "fontScale") ?? 100000;
  const size = (first((item) => numberAttr(item, "sz")) ?? DEFAULT_FONT_SIZE) * fontScale / 100000;
  const alignment = [child(firstParagraph, "pPr"), ...levelOne].map((item) => item?.getAttribute("algn")).find((value) => value);
  return {
    size: Math.max(8, Math.round(size / 100 * EMU_PER_POINT * context.scale)),
    bold: first((item) => boolAttr(item, "b")) ?? false,
    // A shape's style colour (e.g. white text on a filled shape) outranks inherited defaults.
    color: first((item) => readFill(item, context.colors), runProps.slice(0, 2))
      ?? readColor(path(element, "style", "fontRef")?.firstElementChild ?? null, context.colors)
      ?? first((item) => readFill(item, context.colors)) ?? { color: "#000000", alpha: 1 },
    align: ALIGNMENTS[alignment ?? ""] ?? "left",
  };
}

function textObject(element: Element, box: Box, chain: readonly Element[], context: SlideContext): Record<string, unknown> | null {
  const ownBody = child(element, "txBody");
  if (!ownBody) return null;
  const text = textOf(ownBody);
  if (!text.trim()) return null;
  const style = readTextStyle(ownBody, chain, element, context);
  const bodyProps = chain.map((item) => path(item, "txBody", "bodyPr"));
  const inset = (name: string, fallback: number): number => (bodyProps.map((item) => numberAttr(item, name)).find((value) => value !== null) ?? fallback) * context.scale;
  const left = box.x + inset("lIns", 91440);
  const width = Math.max(20, box.width - inset("lIns", 91440) - inset("rIns", 91440));
  const anchor = bodyProps.map((item) => item?.getAttribute("anchor")).find((value) => value) ?? "t";
  const estimated = text.split("\n").length * style.size * 1.16;
  const free = Math.max(0, box.height - estimated - inset("tIns", 45720) - inset("bIns", 45720));
  const top = box.y + inset("tIns", 45720) + (anchor === "ctr" ? free / 2 : anchor === "b" ? free : 0);
  return {
    type: "Textbox", originX: "left", originY: "top", ...rotatedOrigin(box, left, top), angle: box.angle, width,
    text, fontSize: style.size, fontWeight: style.bold ? 800 : 400, fontFamily: SLIDE_FONT_FAMILY,
    fill: style.color.color, opacity: style.color.alpha, textAlign: style.align, splitByGrapheme: true,
  };
}

// ---- shapes ----

function shapeOutline(element: Element, context: SlideContext, required: boolean): { readonly stroke: string; readonly strokeWidth: number } | null {
  const line = path(element, "spPr", "ln");
  const width = Math.max(1, (numberAttr(line, "w") ?? EMU_PER_POINT) * context.scale);
  const fill = readFill(line, context.colors);
  if (fill === null) return null;
  if (fill) return { stroke: fill.color, strokeWidth: width };
  const styleRef = path(element, "style", "lnRef");
  if (styleRef && numberAttr(styleRef, "idx") !== 0) {
    const color = readColor(styleRef.firstElementChild, context.colors);
    if (color) return { stroke: color.color, strokeWidth: width };
  }
  return required ? { stroke: "#000000", strokeWidth: width } : null;
}

function shapeFill(element: Element, context: SlideContext): Color | null {
  const fill = readFill(child(element, "spPr"), context.colors);
  if (fill !== undefined) return fill;
  const styleRef = path(element, "style", "fillRef");
  return styleRef && numberAttr(styleRef, "idx") !== 0 ? readColor(styleRef.firstElementChild, context.colors) : null;
}

function shapeObjects(element: Element, box: Box, context: SlideContext): Record<string, unknown>[] {
  const prst = path(element, "spPr", "prstGeom")?.getAttribute("prst") ?? "rect";
  const placement = { originX: "left", originY: "top", ...rotatedOrigin(box, box.x, box.y), angle: box.angle, strokeUniform: true };
  if (element.localName === "cxnSp" || prst === "line" || prst.includes("Connector")) {
    const outline = shapeOutline(element, context, true)!;
    const [x1, x2] = box.flipH ? [box.x + box.width, box.x] : [box.x, box.x + box.width];
    const [y1, y2] = box.flipV ? [box.y + box.height, box.y] : [box.y, box.y + box.height];
    return [{ type: "Line", ...placement, x1, y1, x2, y2, ...outline, fill: outline.stroke }];
  }
  const fill = shapeFill(element, context);
  const outline = shapeOutline(element, context, false);
  if (!fill && !outline) return [];
  const paint = { fill: fill?.color ?? "transparent", opacity: fill?.alpha ?? 1, stroke: outline?.stroke ?? "#000000", strokeWidth: outline?.strokeWidth ?? 0 };
  if (prst === "ellipse") return [{ type: "Ellipse", ...placement, ...paint, rx: box.width / 2, ry: box.height / 2 }];
  if (prst === "triangle") return [{ type: "Triangle", ...placement, ...paint, width: box.width, height: box.height, flipY: box.flipV }];
  const radius = prst === "roundRect" ? Math.min(box.width, box.height) * 0.1667 : 0;
  return [{ type: "Rect", ...placement, ...paint, width: box.width, height: box.height, rx: radius, ry: radius }];
}

async function pictureObject(element: Element, box: Box, context: SlideContext): Promise<Record<string, unknown> | null> {
  const id = path(element, "blipFill", "blip")?.getAttributeNS(REL_NS, "embed");
  const target = id ? context.rels.get(id)?.target : undefined;
  const mime = target ? IMAGE_TYPES[target.slice(target.lastIndexOf(".") + 1).toLowerCase()] : undefined;
  if (!target || !mime || box.width < 1 || box.height < 1) return null;
  const data = await context.pkg.read(target);
  if (!data) return null;
  try {
    const image = await encodeSlideImage(new Blob([data], { type: mime }), Math.min(SLIDE_WIDTH, box.width * IMAGE_OVERSAMPLE), Math.min(SLIDE_HEIGHT, box.height * IMAGE_OVERSAMPLE));
    return {
      type: "Image", originX: "left", originY: "top", ...rotatedOrigin(box, box.x, box.y), angle: box.angle,
      src: image.dataUrl, width: image.width, height: image.height,
      scaleX: box.width / image.width, scaleY: box.height / image.height, flipX: box.flipH, flipY: box.flipV,
      stroke: "#101a3a", strokeWidth: 0, strokeUniform: true,
    };
  } catch {
    // Formats the browser cannot decode are skipped rather than failing the whole import.
    return null;
  }
}

async function treeObjects(tree: Element, transform: Transform, context: SlideContext): Promise<Record<string, unknown>[]> {
  const result: Record<string, unknown>[] = [];
  for (const element of Array.from(tree.children)) {
    if (element.localName === "AlternateContent") {
      result.push(...await treeObjects(child(element, "Fallback") ?? element, transform, context));
      continue;
    }
    if (element.localName === "grpSp") {
      const xfrm = path(element, "grpSpPr", "xfrm");
      const off = child(xfrm, "off");
      const ext = child(xfrm, "ext");
      const chOff = child(xfrm, "chOff");
      const chExt = child(xfrm, "chExt");
      const ratio = (outer: number | null, inner: number | null): number => outer && inner ? outer / inner : 1;
      const gx = ratio(numberAttr(ext, "cx"), numberAttr(chExt, "cx"));
      const gy = ratio(numberAttr(ext, "cy"), numberAttr(chExt, "cy"));
      const inner: Transform = {
        sx: gx * transform.sx,
        sy: gy * transform.sy,
        dx: ((numberAttr(off, "x") ?? 0) - (numberAttr(chOff, "x") ?? 0) * gx) * transform.sx + transform.dx,
        dy: ((numberAttr(off, "y") ?? 0) - (numberAttr(chOff, "y") ?? 0) * gy) * transform.sy + transform.dy,
      };
      result.push(...await treeObjects(element, inner, context));
      continue;
    }
    if (!["sp", "cxnSp", "pic"].includes(element.localName)) continue;
    const chain = inheritanceChain(element, context);
    const box = chain.map((item) => readXfrm(path(item, "spPr", "xfrm"), transform)).find((item) => item);
    if (!box) continue;
    if (element.localName === "pic") {
      const picture = await pictureObject(element, box, context);
      if (picture) result.push(picture);
      continue;
    }
    result.push(...shapeObjects(element, box, context));
    const text = textObject(element, box, chain, context);
    if (text) result.push(text);
  }
  return result;
}

function backgroundOf(parts: readonly (Element | null)[], colors: ColorMap): string {
  for (const part of parts) {
    const background = path(part, "cSld", "bg");
    const fill = readFill(child(background, "bgPr"), colors);
    if (fill) return fill.color;
    const reference = child(background, "bgRef");
    const color = readColor(reference?.firstElementChild ?? null, colors);
    if (color) return color.color;
  }
  return "#ffffff";
}

async function themeColors(pkg: PptxPackage, masterPath: string | undefined, master: Element | null): Promise<ColorMap> {
  const colors = new Map<string, string>();
  if (!masterPath) return colors;
  const themePath = [...(await pkg.rels(masterPath)).values()].find((rel) => rel.type.endsWith("/theme"))?.target;
  const scheme = path(themePath ? await pkg.xml(themePath) : null, "themeElements", "clrScheme");
  for (const entry of scheme ? Array.from(scheme.children) : []) {
    const color = readColor(entry.firstElementChild, colors);
    if (color) colors.set(entry.localName, color.color);
  }
  const mapping = child(master, "clrMap");
  for (const name of ["bg1", "tx1", "bg2", "tx2"]) {
    const target = mapping?.getAttribute(name) ?? { bg1: "lt1", tx1: "dk1", bg2: "lt2", tx2: "dk2" }[name]!;
    const color = colors.get(target);
    if (color) colors.set(name, color);
  }
  return colors;
}

/** Reads a .pptx file and returns one Fabric canvas JSON per slide, in presentation order. */
export async function importPptxSlides(file: File): Promise<string[]> {
  if (!/\.pptx$/i.test(file.name)) throw new Error("PPTX 파일만 가져올 수 있습니다.");
  if (file.size > MAX_FILE_BYTES) throw new Error("100MB 이하의 PPTX 파일만 가져올 수 있습니다.");
  const pkg = new PptxPackage(new Uint8Array(await file.arrayBuffer()));
  const presentation = await pkg.xml("ppt/presentation.xml");
  if (!presentation) throw new Error(NOT_PPTX);
  const presentationRels = await pkg.rels("ppt/presentation.xml");
  const size = child(presentation, "sldSz");
  const widthEmu = numberAttr(size, "cx") ?? 12192000;
  const heightEmu = numberAttr(size, "cy") ?? 6858000;
  const scale = Math.min(SLIDE_WIDTH / widthEmu, SLIDE_HEIGHT / heightEmu);
  const transform: Transform = { sx: scale, sy: scale, dx: (SLIDE_WIDTH - widthEmu * scale) / 2, dy: (SLIDE_HEIGHT - heightEmu * scale) / 2 };
  const slidePaths = children(child(presentation, "sldIdLst"), "sldId")
    .map((item) => presentationRels.get(item.getAttributeNS(REL_NS, "id") ?? "")?.target)
    .filter((item): item is string => Boolean(item));

  const canvases: string[] = [];
  for (const slidePath of slidePaths) {
    const slide = await pkg.xml(slidePath);
    if (!slide) continue;
    const rels = await pkg.rels(slidePath);
    const layoutPath = [...rels.values()].find((rel) => rel.type.endsWith("/slideLayout"))?.target;
    const layout = layoutPath ? await pkg.xml(layoutPath) : null;
    const masterPath = layoutPath ? [...(await pkg.rels(layoutPath)).values()].find((rel) => rel.type.endsWith("/slideMaster"))?.target : undefined;
    const master = masterPath ? await pkg.xml(masterPath) : null;
    const colors = await themeColors(pkg, masterPath, master);
    const context: SlideContext = {
      pkg, colors, rels, scale, master,
      layoutTree: path(layout, "cSld", "spTree"),
      masterTree: path(master, "cSld", "spTree"),
      defaultTextStyle: child(presentation, "defaultTextStyle"),
    };
    const tree = path(slide, "cSld", "spTree");
    const objects = tree ? await treeObjects(tree, transform, context) : [];
    canvases.push(JSON.stringify({ objects, background: backgroundOf([slide, layout, master], colors) }));
  }
  return canvases;
}

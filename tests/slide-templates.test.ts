import assert from "node:assert/strict";
import { applyTemplate, SLIDE_TEMPLATES } from "../src/slide-canvas/slideTemplates/index.ts";
import { validateSlides } from "../src/slide-show/validation.ts";
import type { Slide } from "../src/slide-show/types.ts";

const blank: Slide = { id: "slide-1", canvas: JSON.stringify({ objects: [], background: "#ffffff" }), engine: null };
for (const template of SLIDE_TEMPLATES) for (const variant of ["cover", "content"] as const) {
  const applied = applyTemplate(blank, template, { variant });
  assert.deepEqual(applyTemplate(applied, template, { variant }), applied, "reapplying is idempotent");
  const canvas = JSON.parse(applied.canvas);
  assert.equal(canvas.background, template[variant].background);
  assert.equal(canvas.objects.length, template[variant].decorations.length + 2);
  assert.deepEqual(canvas.objects.slice(-2).map((object: { text: string }) => object.text), ["제목을 입력하세요", variant === "cover" ? "부제목을 입력하세요" : "내용을 입력하세요"]);
  assert.ok(canvas.objects.slice(0, -2).every((object: { selectable: boolean; evented: boolean; data: { templateDecoration: boolean } }) => !object.selectable && !object.evented && object.data.templateDecoration));
  assert.equal(validateSlides([applied]).length, 1, "template JSON meets existing persistence limits");
}

/** WCAG 상대 휘도. 양식 본문 대비가 AA(4.5:1) 이상인지 확인한다. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}
function contrast(foreground: string, background: string): number {
  const [high, low] = [luminance(foreground), luminance(background)].sort((a, b) => b - a) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

assert.equal(SLIDE_TEMPLATES.length, 7, "양식은 7종이다");
/** 본문이 카드 위에 있으면 카드 색이 실제 대비 기준이다. 마지막으로 덮는 사각형을 찾는다. */
function textBackground(layout: (typeof SLIDE_TEMPLATES)[number]["cover"], text: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }): string {
  const covering = layout.decorations.filter((shape) => shape.kind === "rect"
    && shape.x <= text.x && shape.y <= text.y
    && shape.x + shape.w >= text.x + text.w && shape.y + shape.h >= text.y + text.h);
  return covering.length ? covering[covering.length - 1]!.color : layout.background;
}
for (const template of SLIDE_TEMPLATES) for (const variant of ["cover", "content"] as const) {
  const layout = template[variant];
  const label = `${template.id}/${variant}`;
  // 표지의 본문은 부제목 한 줄이다. 콘텐츠 본문 영역은 슬라이드 높이의 60% 이상이어야 한다.
  if (variant === "content") assert.ok(layout.body.h >= 60, `${label}: 본문 영역이 슬라이드 높이의 60% 이상이다(${layout.body.h})`);
  assert.ok(layout.body.x >= 0 && layout.body.y >= 0 && layout.body.x + layout.body.w <= 100, `${label}: 본문이 가로 범위 안에 있다`);
  for (const text of [layout.title, layout.body]) {
    const behind = textBackground(layout, text);
    assert.ok(contrast(text.color, behind) >= 4.5, `${label}: ${text.color} on ${behind} 대비 AA 이상`);
    assert.ok(text.size > 0 && text.w > 0 && text.h > 0, `${label}: 글자 크기·영역이 지정돼 있다`);
  }
  for (const shape of layout.decorations) {
    assert.ok(/^#[0-9A-Fa-f]{6}$/.test(shape.color), `${label}: 장식 색 형식`);
  }
  // 제목과 본문 상자는 서로 겹치지 않는다.
  assert.ok(layout.title.y + layout.title.h <= layout.body.y, `${label}: 제목 상자와 본문 상자가 겹치지 않는다`);
}

// '따뜻한 노트': 콘텐츠 흰 카드가 슬라이드 대부분을 차지하고 형광펜이 제목 아래쪽 절반을 덮는다.
const warm = SLIDE_TEMPLATES.find((template) => template.id === "warm-note")!;
const rectOf = (layout: (typeof warm)["cover"], color: string) => {
  const shape = layout.decorations.find((item) => item.kind === "rect" && item.color === color);
  assert.ok(shape && shape.kind === "rect", `장식 ${color} 사각형을 찾는다`);
  return shape;
};
const warmCard = rectOf(warm.content, "#FFF8EC");
assert.deepEqual({ x: warmCard.x, y: warmCard.y, w: warmCard.w, h: warmCard.h }, { x: 3, y: 5, w: 94, h: 90 }, "따뜻한 노트 본문 카드가 크게 배치된다");
const warmCoverCard = rectOf(warm.cover, "#FFF8EC");
assert.deepEqual({ x: warmCoverCard.x, y: warmCoverCard.y, w: warmCoverCard.w, h: warmCoverCard.h, radius: warmCoverCard.radius }, { x: 5, y: 8, w: 90, h: 84, radius: 2.5 }, "표지 흰 카드가 커진 크기와 반경을 쓴다");
for (const layout of [warm.cover, warm.content]) {
  assert.ok(layout.title.x >= warmCard.x && layout.title.y >= warmCard.y, "제목이 카드 안에 있다");
  assert.ok(layout.body.x >= warmCard.x && layout.body.y + layout.body.h <= warmCard.y + warmCard.h, "본문이 카드 안에 있다");
}
const highlighter = rectOf(warm.content, "#FFD43B");
assert.ok(highlighter.y + highlighter.h / 2 >= warm.content.title.y + warm.content.title.h / 2, "형광펜이 제목 상자의 아래쪽 절반을 덮는다");
assert.ok(highlighter.y + highlighter.h <= warm.content.title.y + warm.content.title.h + warm.content.title.h / 2, "형광펜이 제목 위로 넘치지 않는다");

// '노랑 격자': 형광펜이 제목 위로 떠 있지 않고 아래쪽 절반에 깔리며, 초록 장식은 본문 상자 밖에 있다.
const grid = SLIDE_TEMPLATES.find((template) => template.id === "yellow-grid")!;
const gridMarker = rectOf(grid.content, "#FFD43B");
assert.ok(gridMarker.y > grid.content.title.y && gridMarker.y + gridMarker.h / 2 >= grid.content.title.y + grid.content.title.h / 2, "노랑 격자 형광펜이 제목 아래쪽 절반에 깔린다");
assert.ok(gridMarker.y + gridMarker.h <= grid.content.title.y + grid.content.title.h + grid.content.title.h / 2, "노랑 격자 형광펜이 제목 위로 넘치지 않는다");
const bodyBox = grid.content.body;
for (const shape of grid.content.decorations) {
  if (shape.kind !== "rect" || shape === gridMarker) continue;
  const coversBody = shape.x < bodyBox.x + bodyBox.w && shape.x + shape.w > bodyBox.x
    && shape.y < bodyBox.y + bodyBox.h && shape.y + shape.h > bodyBox.y;
  assert.ok(!coversBody, "노랑 격자 본문 위를 덮는 장식이 없다");
}

const image = { type: "Image", src: "data:image/png;base64,AAAA", left: 24, top: 50, width: 123, height: 80 };
const shape = { type: "Rect", left: 70, top: 40, width: 80, height: 120, fill: "#123456", data: { custom: true } };
const body = { type: "Textbox", text: "본문 유지", top: 400, left: 20, width: 300, height: 100, fontSize: 60, fontWeight: 800, fontFamily: "Arial", fill: "#000000", styles: [{ start: 0, end: 2, style: { fontWeight: 700, fontStyle: "italic", fontSize: 23, fill: "#111111", fontFamily: "Arial" } }] };
const title = { type: "Textbox", text: "제목 유지", top: 10, left: 50, width: 450, height: 90, fontSize: 60, styles: { 0: { 1: { underline: true, fontWeight: 800, fill: "#111111" } } } };
const tiny = { type: "Textbox", text: "위에 있지만 작음", fontSize: 12, top: 0 };
const input: Slide = { ...blank, canvas: JSON.stringify({ background: "#ffffff", backgroundImage: image, objects: [image, body, shape, title, tiny] }) };
const original = structuredClone(input);
const template = SLIDE_TEMPLATES[1]!;
const applied = applyTemplate(input, template, { variant: "content" });
const canvas = JSON.parse(applied.canvas);
assert.deepEqual(input, original, "pure apply never mutates the original slide");
assert.equal(canvas.backgroundImage, undefined, "existing background image is removed");
const users = canvas.objects.slice(template.content.decorations.length);
assert.deepEqual(users[0], image, "user image survives unchanged");
assert.deepEqual(users[2], shape, "user shape survives unchanged");
assert.equal(users[3].fontFamily, template.content.title.fontFamily, "equal largest sizes pick the uppermost title");
assert.equal(users[1].fontFamily, template.content.body.fontFamily);
assert.equal(users[4].fontFamily, template.content.body.fontFamily, "a small upper box is not the title");
for (const [before, after] of [[body, users[1]], [title, users[3]]]) {
  for (const key of ["text", "top", "left", "width", "height", "fontSize", "fontWeight"] as const) assert.equal(after[key], before[key as keyof typeof before]);
}
assert.deepEqual(users[1].styles[0].style, { ...body.styles[0]!.style, fontFamily: template.content.body.fontFamily, fill: template.content.body.color }, "inline bold/italics/size survive restyling");
assert.deepEqual(users[3].styles[0][1], { ...title.styles[0][1], fontFamily: template.content.title.fontFamily, fill: template.content.title.color });
const changed = applyTemplate(applied, SLIDE_TEMPLATES[0]!, { variant: "cover" });
assert.equal(JSON.parse(changed.canvas).objects.filter((object: { data?: { templateDecoration?: boolean } }) => object.data?.templateDecoration).length, 3, "switching templates replaces, not accumulates, decoration");
assert.equal(JSON.parse(changed.canvas).objects.length, 8);
assert.equal(validateSlides([changed]).length, 1);
console.log("slide template tests passed");

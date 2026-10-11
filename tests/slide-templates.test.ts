import assert from "node:assert/strict";
import { applyTemplate, SLIDE_TEMPLATES } from "../src/slide-canvas/slideTemplates.ts";
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

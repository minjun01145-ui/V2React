import assert from "node:assert/strict";
import { planDeckOperations, splitAssistantReply } from "../src/slide-assistant/deckPlan.ts";
import { parseAssistantReply } from "../src/slide-assistant/validation.ts";
import { emptySlideCanvas, moveSlideTo, removeSlideAt, replaceSlideText, slideTexts } from "../src/slide-canvas/slideEdits.ts";
import type { Slide } from "../src/slide-show/types.ts";

const FONTS = ["'Noto Sans KR', sans-serif", "'Jua', sans-serif"];

function slide(canvas: unknown, id: string = crypto.randomUUID()): Slide {
  return { id, canvas: JSON.stringify(canvas), engine: null };
}

function textbox(text: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { type: "Textbox", text, left: 10, top: 20, width: 400, fontSize: 40, ...extra };
}

const deck: readonly Slide[] = [
  slide({ background: "#ffffff", objects: [textbox("오늘의 수업"), textbox("안녕하세요 친구들")] }),
  slide({ background: "#ffffff", objects: [textbox("지난 시간에는 되요 라고 썼어요")] }),
  slide({ background: "#ffffff", objects: [textbox("되요 대신 돼요")] }),
];

// ---- reply validation: the AI's operations are untrusted browser input ----

const reply = parseAssistantReply({
  message: "3번 슬라이드의 '되요'를 고쳤어요.",
  operations: [
    { op: "move", id: "o1", left: 100.4, top: 5000 },
    { op: "style", id: "o2", fill: "#FF0000", textAlign: "center", fontWeight: 700 },
    { op: "arrange", id: "o1", action: "front" },
    { op: "addImage", query: "city bus", width: 400 },
    { op: "replaceText", from: "되요", to: "돼요", slides: "all" },
    { op: "addShape", shape: "circle", left: 10, top: 10, width: 100, height: 100 },
    { op: "move", id: "title", left: 1, top: 1 },
    { op: "style", id: "o1", fill: "red" },
    { op: "arrange", id: "o1", action: "sideways" },
    { op: "style", id: "o1", fontFamily: "'Comic Sans MS', cursive" },
    { op: "deleteSlide", slide: 0 },
    { op: "runScript", code: "x" },
  ],
}, FONTS);

assert.equal(reply.message, "3번 슬라이드의 '되요'를 고쳤어요.");
assert.equal(reply.dropped, 6, "unknown ids, bad colours, bad actions, unknown fonts and unknown ops are dropped");
assert.deepEqual(reply.operations[0], { op: "move", id: "o1", left: 100, top: 1440 }, "positions are rounded and kept near the slide");
assert.deepEqual(reply.operations[1], { op: "style", id: "o2", fill: "#ff0000", textAlign: "center" }, "only the given style fields are kept");
assert.deepEqual(reply.operations[2], { op: "arrange", id: "o1", action: "front" });
assert.deepEqual(reply.operations[3], { op: "addImage", query: "city bus", width: 400 });
assert.deepEqual(reply.operations[4], { op: "replaceText", from: "되요", to: "돼요", slides: "all" });
assert.throws(() => parseAssistantReply({ operations: "nope" }, FONTS), /확인하지 못했/);
assert.throws(() => parseAssistantReply({ operations: Array.from({ length: 41 }, () => ({ op: "delete", id: "o1" })) }, FONTS), /확인하지 못했/);
assert.deepEqual(parseAssistantReply({ operations: [{ op: "background", color: "#FFF6DF", slide: "all" }] }, FONTS).operations,
  [{ op: "background", color: "#fff6df", slide: "all" }], "a background can target other slides");
assert.deepEqual(parseAssistantReply({ operations: [{ op: "addSlide" }] }, FONTS).operations, [{ op: "addSlide" }]);

// ---- deck and canvas split ----

const described = {
  background: "#ffffff",
  objects: [
    { id: "o1", kind: "text" as const, z: 1, left: 10, top: 20, width: 400, height: 60, text: "안녕하세요 되요" },
    { id: "o2", kind: "shape" as const, z: 2, left: 10, top: 200, width: 100, height: 100 },
  ],
};
const split = splitAssistantReply([
  { op: "move", id: "o1", left: 1, top: 1 },
  { op: "arrange", id: "o1", action: "front" },
  { op: "replaceText", from: "되요", to: "돼요", slides: "all" },
  { op: "replaceText", from: "안녕", to: "반가워", slides: 2 },
  { op: "background", color: "#fff6df" },
  { op: "background", color: "#0f1846", slide: "all" },
  { op: "deleteSlide", slide: 3 },
], 1, described);
assert.deepEqual(split.canvas.map((operation) => operation.op), ["move", "arrange", "setText", "background", "background"],
  "a text fix and a background that name this slide also reach the canvas");
assert.deepEqual(split.canvas[2], { op: "setText", id: "o1", text: "안녕하세요 돼요" }, "only the described text boxes are rewritten");
assert.deepEqual(split.canvas[3], { op: "background", color: "#fff6df" });
assert.deepEqual(split.canvas[4], { op: "background", color: "#0f1846" });
assert.deepEqual(split.deck.map((operation) => operation.op), ["replaceText", "replaceText", "background", "deleteSlide"],
  "a text fix and a background that name another slide stay on the slide list");
assert.deepEqual(split.deck[0], { op: "replaceText", from: "되요", to: "돼요", slides: "all" });
assert.deepEqual(split.deck[1], { op: "replaceText", from: "안녕", to: "반가워", slides: 2 });
assert.deepEqual(split.deck[3], { op: "deleteSlide", slide: 3 });
assert.deepEqual(splitAssistantReply([{ op: "replaceText", from: "되요", to: "돼요", slides: 2 }], 1, described),
  { canvas: [], deck: [{ op: "replaceText", from: "되요", to: "돼요", slides: 2 }] }, "a fix that never mentions this slide leaves the canvas alone");

// ---- deck edits ----

const replaced = planDeckOperations({ slides: deck, current: 1 }, [{ op: "replaceText", from: "되요", to: "돼요", slides: "all" }]);
assert.equal(replaced.count, 2, "text is replaced on the other slides only");
assert.deepEqual(slideTexts(replaced.slides[1]!.canvas), ["지난 시간에는 돼요 라고 썼어요"]);
assert.deepEqual(slideTexts(replaced.slides[2]!.canvas), ["돼요 대신 돼요"]);
assert.deepEqual(slideTexts(replaced.slides[0]!.canvas), ["오늘의 수업", "안녕하세요 친구들"], "the edited slide is left for the canvas");

const oneSlide = planDeckOperations({ slides: deck, current: 1 }, [{ op: "replaceText", from: "되요", to: "돼요", slides: 2 }]);
assert.equal(oneSlide.count, 1);
assert.deepEqual(slideTexts(oneSlide.slides[2]!.canvas), ["되요 대신 돼요"], "the other slides keep their text");

const nothing = planDeckOperations({ slides: deck, current: 1 }, [{ op: "replaceText", from: "없는 말", to: "x", slides: "all" }]);
assert.equal(nothing.count, 0);
assert.equal(nothing.slides, deck, "an unmatched replacement returns the same list");

const added = planDeckOperations({ slides: deck, current: 1 }, [{ op: "addSlide", after: 2, background: "#fff6df" }]);
assert.equal(added.slides.length, 4);
assert.equal(added.count, 1);
assert.equal(JSON.parse(added.slides[2]!.canvas).background, "#fff6df");
assert.equal(added.slides[2]!.engine, null);

assert.equal(planDeckOperations({ slides: deck, current: 1 }, [{ op: "duplicateSlide", slide: 2 }]).slides.length, 4);
assert.deepEqual(planDeckOperations({ slides: deck, current: 1 }, [{ op: "deleteSlide", slide: 2 }]).slides.map((item) => slideTexts(item.canvas)[0]), ["오늘의 수업", "되요 대신 돼요"]);
assert.equal(planDeckOperations({ slides: deck.slice(0, 1), current: 1 }, [{ op: "deleteSlide", slide: 1 }]).count, 0, "the last slide stays");
assert.deepEqual(planDeckOperations({ slides: deck, current: 1 }, [{ op: "moveSlide", from: 3, to: 1 }]).slides.map((item) => slideTexts(item.canvas)[0]),
  ["되요 대신 돼요", "오늘의 수업", "지난 시간에는 되요 라고 썼어요"]);

const recoloured = planDeckOperations({ slides: deck, current: 2 }, [{ op: "background", color: "#0f1846", slide: "all" }]);
assert.equal(recoloured.count, 2, "the slide being edited is recoloured by the canvas, not here");
assert.equal(JSON.parse(recoloured.slides[1]!.canvas).background, "#ffffff");

// ---- pure helpers keep formatting and never mutate their input ----

const styled = slide({ objects: [textbox("가나다라", { styles: [{ start: 0, end: 2, style: { fontWeight: 700 } }] })] });
const original = structuredClone(styled);
const shortened = replaceSlideText(styled, "라", "");
assert.ok(shortened);
assert.deepEqual(styled, original, "replace never mutates the slide it was given");
assert.equal(slideTexts(shortened.slide.canvas)[0], "가나다");
assert.deepEqual(JSON.parse(shortened.slide.canvas).objects[0].styles, [{ start: 0, end: 2, style: { fontWeight: 700 } }],
  "a run whose characters all survive keeps its formatting");
const collapsed = replaceSlideText(slide({ objects: [textbox("가나다라", { styles: [{ start: 0, end: 4, style: { fontSize: 20 } }] })] }), "나다", "나");
assert.deepEqual(JSON.parse(collapsed!.slide.canvas).objects[0].styles, [], "a run cut apart by a replacement is dropped rather than pointing at the wrong characters");
assert.equal(replaceSlideText(styled, "없음", "x"), null);
assert.equal(replaceSlideText(styled, "", "x"), null, "an empty search text is refused");

const nested = slide({ objects: [{ type: "Group", objects: [textbox("묶인 글")] }] });
assert.equal(replaceSlideText(nested, "묶인", "푼")?.count, 1, "text inside a group is replaced too");

const slides = [slide({}, "a"), slide({}, "b"), slide({}, "c")];
assert.equal(removeSlideAt(slides, 5), null);
assert.equal(insertSlideCount(slides), 4);
assert.equal(moveSlideTo(slides, 1, 1), null, "moving onto itself changes nothing");
assert.equal(moveSlideTo(slides, 1, 3)!.map((item) => item.id).join(""), "bca");

function insertSlideCount(list: readonly Slide[]): number {
  const next = planDeckOperations({ slides: list, current: 1 }, [{ op: "addSlide" }]).slides;
  assert.equal(next.length, list.length + 1);
  assert.equal(next[next.length - 1]!.canvas, emptySlideCanvas());
  return next.length;
}
console.log("slide assistant operation tests passed");

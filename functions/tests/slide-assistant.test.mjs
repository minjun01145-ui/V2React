import assert from "node:assert/strict";
import { parseSlideAssistantReply, parseSlideAssistantRequest } from "../lib/slide-assistant/service.js";

const FONTS = ["'Noto Sans KR', sans-serif", "'Jua', sans-serif"];

function deck(extra = {}) {
  return {
    slideCount: 3,
    current: 2,
    currentSlide: { background: "#ffffff", objects: [{ id: "o1", kind: "text", left: 10, top: 20, text: "안녕" }] },
    otherSlides: [{ n: 1, texts: ["첫 슬라이드"] }, { n: 3, texts: ["셋째 슬라이드"] }],
    fonts: FONTS,
    ...extra,
  };
}

const request = parseSlideAssistantRequest({ instruction: "  줄 맞춰줘 ", deck: deck() });
assert.equal(request.instruction, "줄 맞춰줘");
assert.equal(request.fonts.length, 2);
assert.deepEqual(JSON.parse(request.deckJson).otherSlides, [{ n: 1, texts: ["첫 슬라이드"] }, { n: 3, texts: ["셋째 슬라이드"] }]);
assert.throws(() => parseSlideAssistantRequest({ instruction: "", deck: deck() }), /요청은/);
assert.throws(() => parseSlideAssistantRequest({ instruction: "x", deck: deck({ current: 4 }) }), /슬라이드 정보/);
assert.throws(() => parseSlideAssistantRequest({ instruction: "x", deck: deck({ currentSlide: null }) }), /슬라이드 정보/);
assert.throws(() => parseSlideAssistantRequest({ instruction: "x", deck: deck({ currentSlide: { background: "#fff", objects: Array.from({ length: 400 }, (_, index) => ({ id: `o${index}`, text: "가".repeat(40) })) } }) }), /너무 많아/);
assert.throws(() => parseSlideAssistantRequest({ instruction: "x", deck: deck({ otherSlides: Array.from({ length: 400 }, () => ({ n: 1, texts: [] })) }) }), /슬라이드 정보/);

const reply = parseSlideAssistantReply(`설명 앞의 잡담 {"message":"두 글상자의 왼쪽을 맞췄어요.","operations":[
  {"op":"move","id":"o1","left":80.4,"top":5000},
  {"op":"style","id":"o2","fill":"#FF0000","textAlign":"center","fontFamily":"'Jua', sans-serif","background":null},
  {"op":"arrange","id":"o1","action":"front"},
  {"op":"addImage","query":"red apple","width":400},
  {"op":"replaceText","from":"되요","to":"돼요","slides":"all"},
  {"op":"addSlide","after":2},
  {"op":"moveSlide","from":3,"to":1},
  {"op":"background","color":"#FFF6DF","slide":2},
  {"op":"addShape","shape":"circle","left":10,"top":10,"width":100,"height":100}
]} 뒤 잡담`, FONTS);
assert.equal(reply.message, "두 글상자의 왼쪽을 맞췄어요.");
assert.deepEqual(reply.operations[0], { op: "move", id: "o1", left: 80, top: 1440 }, "positions are rounded and kept near the slide");
assert.deepEqual(reply.operations[1], { op: "style", id: "o2", fill: "#ff0000", textAlign: "center", fontFamily: "'Jua', sans-serif", background: null }, "only the given style fields are kept");
assert.deepEqual(reply.operations[2], { op: "arrange", id: "o1", action: "front" });
assert.deepEqual(reply.operations[3], { op: "addImage", query: "red apple", width: 400 });
assert.deepEqual(reply.operations[4], { op: "replaceText", from: "되요", to: "돼요", slides: "all" }, "a review can fix the same wording across the deck");
assert.deepEqual(reply.operations[5], { op: "addSlide", after: 2 });
assert.deepEqual(reply.operations[6], { op: "moveSlide", from: 3, to: 1 });
assert.deepEqual(reply.operations[7], { op: "background", color: "#fff6df", slide: 2 });
assert.deepEqual(reply.operations[8], { op: "addShape", shape: "circle", left: 10, top: 10, width: 100, height: 100 });

assert.throws(() => parseSlideAssistantReply('{"operations":[{"op":"move","id":"title","left":1,"top":1}]}'), /요소/, "ids must be the ones the slide description used");
assert.throws(() => parseSlideAssistantReply('{"operations":[{"op":"style","id":"o1","fill":"red"}]}'), /색/);
assert.throws(() => parseSlideAssistantReply('{"operations":[{"op":"style","id":"o1","fontFamily":"Comic Sans MS"}]}', FONTS), /글꼴/, "fonts must come from the editor's list");
assert.throws(() => parseSlideAssistantReply('{"operations":[{"op":"arrange","id":"o1","action":"sideways"}]}'), /순서/);
assert.throws(() => parseSlideAssistantReply('{"operations":[{"op":"deleteSlide","slide":0}]}'), /슬라이드 번호/);
assert.throws(() => parseSlideAssistantReply('{"operations":[{"op":"setText","id":"o1","text":"  "}]}'), /글을/);
assert.throws(() => parseSlideAssistantReply(`{"operations":[${Array.from({ length: 4 }, () => '{"op":"addImage","query":"bus"}').join(",")}]}`, FONTS), /그림 수/);
assert.throws(() => parseSlideAssistantReply('{"operations":[{"op":"runScript","code":"x"}]}'), /지원하지 않는/);
assert.throws(() => parseSlideAssistantReply("no json here"), /형식/);

console.log("slide assistant tests passed");

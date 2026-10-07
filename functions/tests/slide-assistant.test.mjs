import assert from "node:assert/strict";
import { parseSlideAssistantReply, parseSlideAssistantRequest } from "../lib/slide-assistant/service.js";

const request = parseSlideAssistantRequest({ instruction: "  줄 맞춰줘 ", slide: { background: "#ffffff", objects: [{ id: "o1", kind: "text", left: 10, top: 20 }] } });
assert.equal(request.instruction, "줄 맞춰줘");
assert.throws(() => parseSlideAssistantRequest({ instruction: "", slide: { objects: [] } }), /요청은/);
assert.throws(() => parseSlideAssistantRequest({ instruction: "x", slide: { objects: Array.from({ length: 400 }, (_, index) => ({ id: `o${index}`, text: "가".repeat(40) })) } }), /너무 많아/);

const reply = parseSlideAssistantReply(`설명 앞의 잡담 {"message":"두 글상자의 왼쪽을 맞췄어요.","operations":[
  {"op":"move","id":"o1","left":80.4,"top":5000},
  {"op":"style","id":"o2","fill":"#FF0000","textAlign":"center","background":null},
  {"op":"addImage","query":"red apple","width":400},
  {"op":"addShape","shape":"circle","left":10,"top":10,"width":100,"height":100}
]} 뒤 잡담`);
assert.equal(reply.message, "두 글상자의 왼쪽을 맞췄어요.");
assert.deepEqual(reply.operations[0], { op: "move", id: "o1", left: 80, top: 1440 }, "positions are rounded and kept near the slide");
assert.deepEqual(reply.operations[1], { op: "style", id: "o2", fill: "#ff0000", textAlign: "center", background: null }, "only the given style fields are kept");
assert.deepEqual(reply.operations[2], { op: "addImage", query: "red apple", width: 400 });

assert.throws(() => parseSlideAssistantReply('{"operations":[{"op":"move","id":"title","left":1,"top":1}]}'), /요소/, "ids must be the ones the slide description used");
assert.throws(() => parseSlideAssistantReply('{"operations":[{"op":"style","id":"o1","fill":"red"}]}'), /색/);
assert.throws(() => parseSlideAssistantReply('{"operations":[{"op":"runScript","code":"x"}]}'), /지원하지 않는/);
assert.throws(() => parseSlideAssistantReply("no json here"), /형식/);

console.log("slide assistant tests passed");

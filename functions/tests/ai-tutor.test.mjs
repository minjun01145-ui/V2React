import assert from "node:assert/strict";
import { buildAiTutorMessages } from "../lib/ai-tutor/prompt.js";
import { parseAiTutorReply, parseAiTutorTurnInput } from "../lib/ai-tutor/validation.js";

const turn = parseAiTutorTurnInput({
  roomId: "room-1",
  roundId: "round-1",
  itemId: "item-1",
  message: "나는 매일 학교에 간다",
  attemptNumber: 1,
  previousFeedback: null,
});
assert.equal(turn.message, "나는 매일 학교에 간다");
assert.equal(parseAiTutorTurnInput({ ...turn, roomId: "영어-1반" }).roomId, "영어-1반");
assert.throws(() => parseAiTutorTurnInput({ ...turn, message: "" }), /답변/);
assert.throws(() => parseAiTutorTurnInput({ ...turn, roomId: "../room" }), /대기실/);

const messages = buildAiTutorMessages({
  setType: "reading-chunks",
  direction: "source-to-meaning",
  item: { id: "item-1", sourceText: "I go / to school / every day.", meaning: "나는 / 매일 / 학교에 간다." },
}, turn);
assert.equal(messages[0]?.role, "system");
assert.match(messages[0]?.content ?? "", /무관한 질문/);
assert.match(messages[0]?.content ?? "", /기준 답안 전체를 절대 공개하지 않는다/);

const retry = parseAiTutorReply('```json\n{"kind":"retry","feedback":"조금 아쉬워요","hint":"시제를 확인하세요","focus":"동사"}\n```');
assert.equal(retry.isCorrect, false);
assert.equal(retry.scoreDelta, 0);

const offTopic = parseAiTutorReply('{"kind":"off-topic","feedback":"서울은 대한민국의 수도입니다","hint":"유출","focus":"유출"}');
assert.equal(offTopic.feedback, "지금 문제와 관련된 답이나 질문만 입력해 주세요.");
assert.equal(offTopic.hint, null);
assert.equal(offTopic.focus, null);

console.log("AI tutor server contract tests passed");

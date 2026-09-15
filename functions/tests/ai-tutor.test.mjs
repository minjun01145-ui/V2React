import assert from "node:assert/strict";
import { mock } from "node:test";
import { buildAiTutorMessages } from "../lib/ai-tutor/prompt.js";
import { loadAiTutorRoundContext } from "../lib/ai-tutor/repository.js";
import { db } from "../lib/shared/firebase.js";
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
assert.equal(turn.direction, null);
assert.equal(parseAiTutorTurnInput({ ...turn, direction: "meaning-to-source" }).direction, "meaning-to-source");
assert.throws(() => parseAiTutorTurnInput({ ...turn, direction: "sideways" }), /문제 방향/);
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

const directItem = { id: "item-1", sourceText: "apple", meaning: "사과" };
const secondItem = { id: "item-2", sourceText: "book", meaning: "책" };
const session = {
  status: "playing",
  roundId: turn.roundId,
  gameId: "ai-tutor",
  gameConfig: {
    set: { id: "quiz-round-1", name: "직접 출제", type: "vocabulary", itemCount: 2, items: [directItem, secondItem] },
    direction: "meaning-to-source",
  },
};
const sessionPath = `multiplayerSessions/${turn.roomId}`;
const participantPath = `${sessionPath}/rounds/${turn.roundId}/participants/student-1`;
const documents = new Map([[sessionPath, session], [participantPath, {}]]);
function reference(path) {
  return {
    collection: (name) => reference(`${path}/${name}`),
    doc: (id) => reference(`${path}/${id}`),
    get: async () => ({ exists: documents.has(path), data: () => documents.get(path) }),
  };
}
const collectionMock = mock.method(db, "collection", (name) => reference(name));
const contextInput = { uid: "student-1", roomId: turn.roomId, roundId: turn.roundId, itemId: turn.itemId, requestedDirection: "source-to-meaning" };
try {
  // 세트 ID 없이 직접 출제 문항으로 채점 프롬프트를 만들 수 있어야 한다.
  const directContext = await loadAiTutorRoundContext(contextInput);
  assert.deepEqual(directContext, { setType: "vocabulary", direction: "meaning-to-source", item: directItem });
  const directMessages = buildAiTutorMessages(directContext, turn);
  assert.match(directMessages[0].content, /제시문: 사과/);
  assert.match(directMessages[0].content, /교사용 기준 답안: apple/);
  assert.deepEqual((await loadAiTutorRoundContext({ ...contextInput, itemId: secondItem.id })).item, secondItem);
  await assert.rejects(loadAiTutorRoundContext({ ...contextInput, itemId: "not-in-round" }), /문항을 찾을 수 없습니다/);

  session.gameConfig.direction = "source-to-meaning";
  assert.equal((await loadAiTutorRoundContext({ ...contextInput, requestedDirection: "meaning-to-source" })).direction, "source-to-meaning");
  session.gameConfig.set.type = "reading-chunks";
  assert.equal((await loadAiTutorRoundContext(contextInput)).setType, "reading-chunks");
  session.gameConfig.set.type = "invalid";
  await assert.rejects(loadAiTutorRoundContext(contextInput), /문항을 찾을 수 없습니다/);
  session.gameConfig.set.type = "vocabulary";
  session.gameConfig.set.items = [{ ...directItem, meaning: "" }];
  await assert.rejects(loadAiTutorRoundContext(contextInput), /문항을 찾을 수 없습니다/);
  session.gameConfig.set.items = [directItem];

  documents.delete(participantPath);
  await assert.rejects(loadAiTutorRoundContext(contextInput), /현재 참여 중인/);
  documents.set(participantPath, {});
  session.roundId = "other-round";
  await assert.rejects(loadAiTutorRoundContext(contextInput), /현재 참여 중인/);
  session.roundId = turn.roundId;
  session.status = "waiting";
  await assert.rejects(loadAiTutorRoundContext(contextInput), /현재 참여 중인/);
  session.status = "playing";

  // 저장된 세트와 포켓몬 게임의 방향 선택도 기존 동작을 보존한다.
  session.gameConfig = { setId: "set-1", direction: "meaning-to-source" };
  documents.set("learningSets/set-1", { type: "vocabulary" });
  documents.set("learningSets/set-1/content/main", { items: [directItem] });
  assert.deepEqual(await loadAiTutorRoundContext(contextInput), { setType: "vocabulary", direction: "meaning-to-source", item: directItem });
  session.gameId = "pokemon-catch";
  assert.equal((await loadAiTutorRoundContext(contextInput)).direction, "source-to-meaning");
  assert.equal((await loadAiTutorRoundContext({ ...contextInput, requestedDirection: "meaning-to-source" })).direction, "meaning-to-source");
  documents.set("learningSets/set-1", { type: "student-questions" });
  assert.equal((await loadAiTutorRoundContext({ ...contextInput, requestedDirection: "meaning-to-source" })).direction, "source-to-meaning");
  session.gameConfig = {};
  await assert.rejects(loadAiTutorRoundContext(contextInput), /학습 세트 또는 직접 출제 문항/);
} finally {
  collectionMock.mock.restore();
}

console.log("AI tutor server contract tests passed");

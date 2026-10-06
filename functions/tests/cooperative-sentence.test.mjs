import assert from "node:assert/strict";
import { mock } from "node:test";
import { hardModeDeadline, isHardModeTurnExpired, partnerDisplayName, teamSizes } from "../lib/cooperative-sentence/model.js";
import { db } from "../lib/shared/firebase.js";
import { submitSentence } from "../lib/cooperative-sentence/service.js";
import { chunksToWords, readSentenceUnit, sentenceTextKey, sentenceUnits, splitSentenceWords } from "../lib/shared/sentenceWords.js";

assert.deepEqual(teamSizes(2), [2]);
assert.deepEqual(teamSizes(3), [3]);
assert.deepEqual(teamSizes(5), [2, 3]);
assert.deepEqual(teamSizes(9), [2, 2, 2, 3]);
assert.equal(teamSizes(9).reduce((sum, size) => sum + size, 0), 9);
assert.equal(partnerDisplayName("별빛", "홍길동"), "별빛");
assert.equal(partnerDisplayName(null, "홍길동"), "홍길동");
assert.equal(hardModeDeadline(true, 10_000), 15_000);
assert.equal(hardModeDeadline(false, 10_000), null);
assert.equal(isHardModeTurnExpired(true, 15_000, 14_999), false);
assert.equal(isHardModeTurnExpired(true, 15_000, 15_000), true);
assert.equal(isHardModeTurnExpired(false, 15_000, 20_000), false);
for (const config of [undefined, null, [], "word", { "sentence-unit": true }, { "sentence-unit": "invalid" }]) {
  assert.equal(readSentenceUnit(config), "chunk");
}
assert.equal(readSentenceUnit({ "sentence-unit": "word" }), "word");
assert.deepEqual(splitSentenceWords(" Ｉ\t am  a student. "), ["I", "am", "a", "student."]);
assert.deepEqual(chunksToWords(["I am", "a student."]), ["I", "am", "a", "student."]);
assert.deepEqual(sentenceUnits(["I am", "a student."], "chunk"), ["I am", "a student."]);
assert.equal(sentenceTextKey("  ‘ＶＥＲＹ!’  "), "very");

// Exercise the service with the session config and the authoritative item text.
const documents = new Map();
const reference = (path) => ({ path, id: path.split("/").at(-1), collection: (name) => reference(`${path}/${name}`), doc: (id) => reference(`${path}/${id}`), get: async () => snapshot(path) });
const snapshot = (path) => ({ exists: documents.has(path), id: path.split("/").at(-1), ref: reference(path), data: () => documents.get(path) });
mock.method(db, "collection", (name) => reference(name));
mock.method(db, "runTransaction", async (callback) => {
  const writes = [];
  const result = await callback({
    get: async (ref) => { assert.equal(writes.length, 0); return snapshot(ref.path); },
    set: (ref, data) => writes.push([ref.path, data]),
    update: (ref, data) => writes.push([ref.path, { ...documents.get(ref.path), ...data }]),
  });
  for (const [path, data] of writes) documents.set(path, data);
  return result;
});
const roundPath = "multiplayerSessions/room/rounds/round";
try {
  const cases = [
    { unit: undefined, sourceText: "Very / very! / good.", order: [1, 0, 2], correct: true },
    { unit: "word", sourceText: "The cat / and the dog.", order: [3, 1, 2, 0, 4], correct: true },
    { unit: "word", sourceText: "The cat / and the dog.", order: [0, 1, 2, 0, 4], correct: false },
    { unit: "word", sourceText: "The cat / and the dog.", order: [0, 1, 2, 3, 99], correct: false },
    { unit: "word", sourceText: "The cat / and the dog.", order: [0, 1, 2, 3], correct: false },
    { unit: "word", sourceText: "The cat / and the dog.", order: [1, 0, 2, 3, 4], correct: false },
  ];
  for (const { unit, sourceText, order, correct } of cases) {
    documents.clear();
    documents.set("multiplayerSessions/room", { status: "playing", gameId: "cooperative-sentence-builder", roundId: "round", gameConfig: { setId: "set", "sentence-unit": unit } });
    documents.set("learningSets/set", { type: "reading-chunks" });
    documents.set("learningSets/set/content/main", { items: [
      { id: "unsplit", sourceText: "Skip this sentence.", meaning: "제외" },
      { id: "sentence", sourceText, meaning: "뜻" },
    ] });
    for (const playerId of ["alice", "bob"]) documents.set(`${roundPath}/cooperativeAssignments/${playerId}`, { teamId: "team", status: "active", isMyTurn: playerId === "alice", generation: 1 });
    documents.set(`${roundPath}/cooperativeTeams/team`, { name: "team", memberIds: ["alice", "bob"], memberProfiles: [{ playerId: "alice" }, { playerId: "bob" }], status: "active", hearts: 2, currentQuestionIndex: 0, questionCount: 1, turnMemberIndex: 0, generation: 1 });
    const result = await submitSentence("alice", { roomId: "room", roundId: "round", generation: 1, questionId: "sentence", submissionId: "attempt", tokenIds: order.map((index) => `sentence:chunk:${index}`) });
    assert.equal(result.isCorrect, correct, `${unit ?? "chunk"}: ${order}`);
    assert.equal(result.completed, correct);
    assert.equal(documents.get(`${roundPath}/cooperativeTeams/team`).hearts, correct ? 2 : 1);
  }
} finally {
  mock.restoreAll();
}
console.log("cooperative sentence server model/service tests passed");

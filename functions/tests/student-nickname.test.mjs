import assert from "node:assert/strict";
import { mock } from "node:test";
import { koreanDayKey, parseDailyRandomNickname, randomNicknameDocumentId } from "../lib/student-nickname/model.js";
import { RANDOM_NICKNAME_POOL, pickNicknameOfGrade, pickRandomNickname } from "../lib/student-nickname/pool.js";

// The roll day is the Korea-time date: 14:59Z is still the previous day, 15:00Z rolls over.
assert.equal(koreanDayKey(Date.parse("2026-09-23T14:59:59.999Z")), "2026-09-23");
assert.equal(koreanDayKey(Date.parse("2026-09-23T15:00:00.000Z")), "2026-09-24");

const rollDay = "2026-09-24";
assert.deepEqual(
  parseDailyRandomNickname({ nickname: "사차인치", nicknameGrade: "S", rollDay }, rollDay),
  { nickname: "사차인치", nicknameGrade: "S", rollDay },
);
assert.equal(parseDailyRandomNickname({ nickname: "라면", nicknameGrade: "C", rollDay: "2026-09-23" }, rollDay), null, "a previous day's roll must not count as today's");
assert.equal(parseDailyRandomNickname({ nickname: "라면", nicknameGrade: "X", rollDay }, rollDay), null);
assert.equal(randomNicknameDocumentId("main-class", rollDay), "main-class:2026-09-24");
assert.throws(() => randomNicknameDocumentId("bad/room", rollDay));

// The server pool stays the single source of grades, so a lobby duplicate is broken with
// another name of the same grade and can never be farmed into a higher grade.
assert.ok(RANDOM_NICKNAME_POOL.length >= 300, `pool must hold 300+ names, has ${RANDOM_NICKNAME_POOL.length}`);
assert.equal(new Set(RANDOM_NICKNAME_POOL.map((item) => item.nickname)).size, RANDOM_NICKNAME_POOL.length, "pool names must be unique");
const sNames = RANDOM_NICKNAME_POOL.filter((item) => item.grade === "S").map((item) => item.nickname);
const replacement = pickNicknameOfGrade("S", new Set([sNames[0]]), () => 0);
assert.ok(replacement && replacement !== sNames[0] && sNames.includes(replacement), "a duplicate must be replaced with another same-grade name");
assert.equal(pickNicknameOfGrade("S", new Set(sNames)), null, "an exhausted grade keeps its name rather than raising the grade");
assert.throws(() => pickRandomNickname(new Set(RANDOM_NICKNAME_POOL.map((item) => item.nickname))), /랜덤 닉네임/);

// Run the real service against an in-memory Firestore boundary to prove one roll per
// Korea-time day and server-only collision handling.
const { db } = await import("../lib/shared/firebase.js");
const documents = new Map();
const playerLists = new Map();
function snapshot(reference) {
  if (reference.kind === "collection") {
    return { docs: (playerLists.get(reference.path) ?? []).map((player) => ({ id: player.id, data: () => player.data })) };
  }
  return { exists: documents.has(reference.path), data: () => documents.get(reference.path) };
}
function reference(path, kind = "doc") {
  return {
    path,
    kind,
    collection: (name) => reference(`${path}/${name}`, "collection"),
    doc: (id) => reference(`${path}/${id}`, "doc"),
    get: async () => snapshot({ path, kind }),
  };
}
mock.method(db, "collection", (name) => reference(name, "collection"));
mock.method(db, "runTransaction", async (callback) => {
  const writes = [];
  const result = await callback({ get: async (ref) => snapshot(ref), set: (ref, data) => writes.push([ref.path, data]) });
  for (const [path, data] of writes) documents.set(path, structuredClone(data));
  return result;
});
const { ensureDailyRandomNickname } = await import("../lib/student-nickname/service.js");

const accountId = "1";
const roomId = "room-1";
const playersPath = `multiplayerSessions/${roomId}/players`;
const noonKst = Date.parse("2026-09-24T03:00:00Z");

playerLists.set(playersPath, []);
const first = await ensureDailyRandomNickname({ accountId, roomId, uid: "me", now: noonKst });
assert.equal(first.rollDay, "2026-09-24");
assert.ok(RANDOM_NICKNAME_POOL.some((item) => item.nickname === first.nickname && item.grade === first.nicknameGrade), "the grade must come from the server pool");
const storedPath = `studentGameData/${accountId}/randomNicknames/${roomId}:2026-09-24`;
assert.equal(documents.get(storedPath).nickname, first.nickname);

// A second call on the same day must return the stored roll, never a fresh pick.
const second = await ensureDailyRandomNickname({ accountId, roomId, uid: "me", now: noonKst });
assert.deepEqual(second, first, "a same-day reload must not reroll");

// The next Korea-time day starts a new roll.
const nextDay = await ensureDailyRandomNickname({ accountId, roomId, uid: "me", now: Date.parse("2026-09-25T03:00:00Z") });
assert.equal(nextDay.rollDay, "2026-09-25");

// A name another player already wears is replaced with another name of the same grade.
const clashRoom = "room-2";
const clashPath = `studentGameData/${accountId}/randomNicknames/${clashRoom}:2026-09-24`;
documents.set(clashPath, { nickname: "라면", nicknameGrade: "C", rollDay: "2026-09-24" });
playerLists.set(`multiplayerSessions/${clashRoom}/players`, [{ id: "other", data: { nickname: "라면" } }]);
const resolved = await ensureDailyRandomNickname({ accountId, roomId: clashRoom, uid: "me", now: noonKst });
assert.equal(resolved.nicknameGrade, "C", "a clash must not change the grade");
assert.notEqual(resolved.nickname, "라면");
const cNames = RANDOM_NICKNAME_POOL.filter((item) => item.grade === "C").map((item) => item.nickname);
assert.ok(cNames.includes(resolved.nickname), "the replacement must stay in the same grade pool");

// A player's own card never counts as a clash, so a joined student keeps their roll.
const selfRoom = "room-3";
const selfPath = `studentGameData/${accountId}/randomNicknames/${selfRoom}:2026-09-24`;
documents.set(selfPath, { nickname: "김밥", nicknameGrade: "C", rollDay: "2026-09-24" });
playerLists.set(`multiplayerSessions/${selfRoom}/players`, [{ id: "me", data: { nickname: "김밥" } }]);
const kept = await ensureDailyRandomNickname({ accountId, roomId: selfRoom, uid: "me", now: noonKst });
assert.equal(kept.nickname, "김밥");
mock.restoreAll();

console.log(`server random nickname tests passed (${RANDOM_NICKNAME_POOL.length} names)`);

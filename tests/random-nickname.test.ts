import assert from "node:assert/strict";
import { RANDOM_NICKNAME_POOL, pickRandomNickname } from "../src/features/student/lobby/randomNickname.ts";
import { dailyRandomNicknameDay, dailyRandomNicknameDocumentId, parseDailyRandomNickname, resolveDailyRandomNickname } from "../src/student-data/random-nickname/model.ts";

assert.ok(RANDOM_NICKNAME_POOL.length >= 300, `랜덤 닉네임 풀은 300개 이상이어야 합니다. 현재 ${RANDOM_NICKNAME_POOL.length}개`);
assert.equal(new Set(RANDOM_NICKNAME_POOL.map((item) => item.nickname)).size, RANDOM_NICKNAME_POOL.length, "랜덤 닉네임은 중복되면 안 됩니다.");
assert.ok(RANDOM_NICKNAME_POOL.every((item) => item.nickname.length >= 2 && item.nickname.length <= 12), "모든 랜덤 닉네임은 기존 길이 제한을 지켜야 합니다.");

const first = pickRandomNickname(new Set(), () => 0);
assert.equal(first.grade, "C");

const allButOne = new Set(RANDOM_NICKNAME_POOL.slice(0, -1).map((item) => item.nickname));
assert.deepEqual(pickRandomNickname(allButOne, () => 0), RANDOM_NICKNAME_POOL.at(-1));

const rollDay = "2026-09-24";
assert.equal(dailyRandomNicknameDay(new Date("2026-09-23T15:30:00.000Z")), rollDay, "랜덤 닉네임 날짜는 한국 시간으로 계산해야 합니다.");
const firstRoll = { nickname: "라면", grade: "C" as const };
const savedRoll = { nickname: "사차인치", nicknameGrade: "S", rollDay };
assert.deepEqual(parseDailyRandomNickname(savedRoll, rollDay), savedRoll);
assert.deepEqual(resolveDailyRandomNickname(savedRoll, firstRoll, rollDay), savedRoll, "이미 저장된 당일 추첨 결과는 새 후보로 바뀌면 안 됩니다.");
assert.equal(parseDailyRandomNickname({ ...savedRoll, rollDay: "2026-09-23" }, rollDay), null, "이전 날짜 추첨 결과를 오늘 결과로 재사용하면 안 됩니다.");
assert.equal(dailyRandomNicknameDocumentId("main-class", rollDay), "main-class:2026-09-24");
assert.throws(() => dailyRandomNicknameDocumentId("bad/room", rollDay));

console.log(`random nickname tests passed (${RANDOM_NICKNAME_POOL.length} names)`);

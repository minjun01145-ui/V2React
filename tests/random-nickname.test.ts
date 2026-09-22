import assert from "node:assert/strict";
import { RANDOM_NICKNAME_POOL, pickRandomNickname } from "../src/features/student/lobby/randomNickname.ts";

assert.ok(RANDOM_NICKNAME_POOL.length >= 300, `랜덤 닉네임 풀은 300개 이상이어야 합니다. 현재 ${RANDOM_NICKNAME_POOL.length}개`);
assert.equal(new Set(RANDOM_NICKNAME_POOL.map((item) => item.nickname)).size, RANDOM_NICKNAME_POOL.length, "랜덤 닉네임은 중복되면 안 됩니다.");
assert.ok(RANDOM_NICKNAME_POOL.every((item) => item.nickname.length >= 2 && item.nickname.length <= 12), "모든 랜덤 닉네임은 기존 길이 제한을 지켜야 합니다.");

const first = pickRandomNickname(new Set(), () => 0);
assert.equal(first.grade, "C");

const allButOne = new Set(RANDOM_NICKNAME_POOL.slice(0, -1).map((item) => item.nickname));
assert.deepEqual(pickRandomNickname(allButOne, () => 0), RANDOM_NICKNAME_POOL.at(-1));

console.log(`random nickname tests passed (${RANDOM_NICKNAME_POOL.length} names)`);

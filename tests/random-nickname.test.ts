import assert from "node:assert/strict";
import { parseDailyRandomNickname } from "../src/student-data/random-nickname/model.ts";

// The browser only validates the graded roll the server callable returns; it never draws or
// stores names, so a malformed response must be rejected rather than displayed.
const roll = { nickname: "사차인치", nicknameGrade: "S", rollDay: "2026-09-24" };
assert.deepEqual(parseDailyRandomNickname(roll), roll);
assert.equal(parseDailyRandomNickname({ ...roll, rollDay: "2026-9-24" }), null);
assert.equal(parseDailyRandomNickname({ ...roll, nicknameGrade: "X" }), null);
assert.equal(parseDailyRandomNickname({ ...roll, nickname: "가" }), null);
assert.equal(parseDailyRandomNickname(null), null);
assert.equal(parseDailyRandomNickname({ nickname: 3, nicknameGrade: "S", rollDay: "2026-09-24" }), null);

console.log("random nickname response tests passed");

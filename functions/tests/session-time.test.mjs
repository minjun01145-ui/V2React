import assert from "node:assert/strict";
import { mock } from "node:test";
import { Timestamp } from "firebase-admin/firestore";
import { resolveSessionStartedAtMs } from "../lib/shared/sessionTime.js";
import { db } from "../lib/shared/firebase.js";
import { issueQuestion } from "../lib/battle/service.js";

const serverTime = Timestamp.fromMillis(100_000);
for (const teacherTime of [40_000, 160_000]) {
  const start = resolveSessionStartedAtMs(serverTime, teacherTime, 3_000);
  assert.equal(start, 103_000, "Teacher clock skew must not change the authoritative start.");
}
assert.equal(resolveSessionStartedAtMs(null, 103_000, 3_000), 103_000, "Legacy start already includes the countdown.");
for (const delay of [-1, Infinity, "3000", null]) {
  assert.equal(resolveSessionStartedAtMs(serverTime, 40_000, delay), 100_000);
}
for (const timestamp of [null, {}, { toMillis: 123 }, { toMillis: () => NaN }, { toMillis: () => { throw new Error("invalid timestamp"); } }]) {
  assert.equal(resolveSessionStartedAtMs(timestamp, 103_000, 3_000), 103_000);
}
for (const legacy of [undefined, null, "100000", NaN, Infinity]) {
  assert.equal(resolveSessionStartedAtMs(null, legacy), null);
}

// An expired round must reject battle actions even when the teacher's clock is ahead.
const session = {
  status: "playing", gameId: "one-on-one-battle", roundId: "round-1",
  startedAt: serverTime, startedAtMs: 400_000, startDelayMs: 3_000,
  gameConfig: { setId: "set-1", timedGameMode: "3-minutes" },
};
mock.method(Date, "now", () => 283_000);
mock.method(db, "collection", () => ({ doc: () => ({ get: async () => ({ data: () => session }) }) }));
try {
  await assert.rejects(issueQuestion("student-1", {
    roomId: "room-1", roundId: "round-1", generation: 1, itemId: "word-1", side: "source",
  }), /게임 시간이 종료되었습니다/);
} finally {
  mock.restoreAll();
}
console.log("server session time tests passed");

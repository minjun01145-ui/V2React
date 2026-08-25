import assert from "node:assert/strict";
import { deduplicatePlayers, isPlayerOnline, selectActivePlayers } from "../src/multiplayer/presence.ts";
import { SESSION_STATUS } from "../src/multiplayer/constants.ts";
import type { Player } from "../src/multiplayer/types.ts";

function player(id: string, studentNumber: string, lastSeenAtMs: number, joinedAtMs = lastSeenAtMs): Player {
  return {
    id,
    playerId: id,
    studentNumber,
    displayName: `학생 ${studentNumber}`,
    state: SESSION_STATUS.WAITING,
    joinedAtMs,
    lastSeenAtMs,
  };
}

const oldLogin = player("old-uid", "10101", 1_000, 500);
const currentLogin = player("new-uid", "10101", 2_000, 1_500);
const anotherStudent = player("other-uid", "10102", 1_900);

assert.deepEqual(deduplicatePlayers([oldLogin, currentLogin, anotherStudent]).map((item) => item.id), ["new-uid", "other-uid"]);
assert.equal(isPlayerOnline(currentLogin, 2_500, 1_000), true);
assert.equal(isPlayerOnline(oldLogin, 2_500, 1_000), false);
assert.deepEqual(selectActivePlayers([oldLogin, currentLogin, anotherStudent], 2_500, 1_000).map((item) => item.id), ["new-uid", "other-uid"]);
assert.deepEqual(selectActivePlayers([oldLogin], 2_500, 1_000), []);

console.log("multiplayer presence tests passed");


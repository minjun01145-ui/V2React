import assert from "node:assert/strict";
import { countExpectedReady, parseRoundReadiness } from "../src/multiplayer/round-readiness/model.ts";

const first = parseRoundReadiness("student-1", { playerId: "student-1", readyAtMs: 10 });
assert.ok(first);
assert.equal(parseRoundReadiness("student-1", { playerId: "student-2", readyAtMs: 10 }), null);
assert.equal(countExpectedReady(["student-1", "student-2"], [first]), 1);
assert.equal(countExpectedReady(["student-1", "student-2"], [first, { playerId: "late-student", readyAtMs: 20 }]), 1);
assert.equal(countExpectedReady(["student-1", "student-2"], [first, { playerId: "student-2", readyAtMs: 30 }]), 2);

console.log("multiplayer readiness tests passed");

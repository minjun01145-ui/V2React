import assert from "node:assert/strict";
import { moveTestStudentSlot, selectTestStudentSlot } from "../src/classroom-test/model.ts";
import {
  createTestStudentBootstrapMessage,
  createTestStudentStatusMessage,
  parseTestStudentBootstrapMessage,
  parseTestStudentToParentMessage,
} from "../src/classroom-test/protocol.ts";
import type { MultiplayerTestStudentCredential } from "../src/classroom-test/types.ts";

const students: readonly MultiplayerTestStudentCredential[] = [
  { slot: 1, studentNumber: "99001", displayName: "테스트 학생 1", joinSecret: "secret-1" },
  { slot: 2, studentNumber: "99002", displayName: "테스트 학생 2", joinSecret: "secret-2" },
  { slot: 3, studentNumber: "99003", displayName: "테스트 학생 3", joinSecret: "secret-3" },
];

assert.equal(moveTestStudentSlot(1, "next", students), 2);
assert.equal(moveTestStudentSlot(3, "next", students), 1);
assert.equal(moveTestStudentSlot(1, "previous", students), 3);
assert.equal(moveTestStudentSlot(99, "next", students), 2);
assert.equal(moveTestStudentSlot(2, "next", []), 2);
assert.equal(selectTestStudentSlot(1, 3, students), 3);
assert.equal(selectTestStudentSlot(1, 99, students), 1);

const bootstrap = createTestStudentBootstrapMessage("11111111-1111-1111-1111-111111111111", "test-room", students[0]!);
assert.deepEqual(parseTestStudentBootstrapMessage(bootstrap), bootstrap);
assert.equal(parseTestStudentBootstrapMessage({ ...bootstrap, roomId: 3 }), null);
assert.equal(parseTestStudentBootstrapMessage({ ...bootstrap, student: { ...students[0], joinSecret: null } }), null);

assert.deepEqual(parseTestStudentToParentMessage({ type: "classroom-test/ready", slot: 2 }), { type: "classroom-test/ready", slot: 2 });
const status = createTestStudentStatusMessage(3, "connected", "연결됨");
assert.deepEqual(parseTestStudentToParentMessage(status), status);
assert.equal(parseTestStudentToParentMessage({ type: "classroom-test/status", slot: 4, status: "connected", message: "" }), null);
assert.equal(parseTestStudentToParentMessage({ type: "classroom-test/status", slot: 1, status: "unknown", message: "" }), null);

console.log("classroom multiplayer test model tests passed");

import assert from "node:assert/strict";
import { mock } from "node:test";

let writes = [];
let board = { generation: 4, strokes: { alice_0: { by: "alice" } }, writers: { alice: { t: 1 } } };
mock.module("firebase-admin/database", { namedExports: {
  getDatabase: () => ({ ref: (path) => ({
    set: async (value) => { writes.push({ path, value }); },
    transaction: async (update) => { board = update(board); writes.push({ path, value: board }); },
  }) }),
} });
const { db } = await import("../lib/shared/firebase.js");
const documents = new Map([
  ["admins/teacher", { active: true, tenantId: "minjun" }],
  ["admins/other-teacher", { active: true, tenantId: "hana" }],
  ["admins/inactive", { active: false, tenantId: "minjun" }],
  ["multiplayerSessions/room", { tenantId: "minjun", status: "waiting" }],
  ["multiplayerSessions/room/players/alice", { nickname: "파란 고래" }],
]);
const reference = (path) => ({
  collection: (name) => reference(`${path}/${name}`), doc: (id) => reference(`${path}/${id}`),
  get: async () => ({ exists: documents.has(path), data: () => documents.get(path) }),
});
mock.method(db, "collection", (name) => reference(name));
const { clearDrawingBoard, joinDrawingBoard } = await import("../lib/collaborative-drawing/callables.js");
const teacher = { uid: "teacher", token: { tenantId: "minjun", firebase: { sign_in_provider: "password" } } };
const alice = { uid: "alice", token: { role: "student", tenantId: "minjun", firebase: { sign_in_provider: "anonymous" } } };
const data = { roomId: "room", boardId: "lobby" };
const call = (fn, auth = teacher, input = data) => fn.run({ auth, data: input });
try {
  for (const input of [null, {}, { ...data, roomId: "../room" }, { ...data, boardId: "bad/name" }, { ...data, boardId: "invented" }]) {
    await assert.rejects(call(joinDrawingBoard, alice, input), (error) => error.code === "invalid-argument");
  }
  await assert.rejects(call(joinDrawingBoard, null), (error) => error.code === "unauthenticated");
  await assert.rejects(call(joinDrawingBoard, { ...alice, uid: "not-in-room" }), (error) => error.code === "permission-denied");
  await assert.rejects(call(joinDrawingBoard, { ...alice, token: { ...alice.token, tenantId: "hana" } }), (error) => error.code === "permission-denied");
  await assert.rejects(call(clearDrawingBoard, alice), (error) => error.code === "unauthenticated");
  await assert.rejects(call(clearDrawingBoard, { ...teacher, uid: "inactive" }), (error) => error.code === "permission-denied");
  await assert.rejects(call(clearDrawingBoard, { ...teacher, uid: "other-teacher" }), (error) => error.code === "permission-denied");
  await assert.rejects(call(clearDrawingBoard, teacher, { ...data, roomId: "unknown-room" }), (error) => error.code === "permission-denied");
  assert.equal(writes.length, 0, "unauthorized requests must never grant access or erase RTDB data");
  await call(joinDrawingBoard, alice);
  assert.deepEqual(writes.at(-1), { path: "drawingAccess/v1/minjun/room/lobby/alice", value: true });
  await call(joinDrawingBoard);
  assert.equal(writes.at(-1).path, "drawingAccess/v1/minjun/room/lobby/teacher");
  await call(clearDrawingBoard);
  assert.deepEqual(board, { generation: 5 }, "clear must delete all stored strokes and invalidate late old-generation writes atomically");
  await call(clearDrawingBoard);
  assert.deepEqual(board, { generation: 6 });
  board = null;
  await call(clearDrawingBoard);
  assert.deepEqual(board, { generation: 1 }, "clearing an empty board must initialize a fresh generation");
} finally { mock.restoreAll(); }
console.log("collaborative drawing access and teacher clear tests passed");

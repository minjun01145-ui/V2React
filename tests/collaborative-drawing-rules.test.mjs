// Run with the RTDB emulator; this test never contacts a production database.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeApp, deleteApp } from "firebase/app";
import { connectDatabaseEmulator, getDatabase, get, ref, serverTimestamp, update } from "firebase/database";

const host = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
assert.ok(host, "Start the Realtime Database emulator before running this test.");
const [hostname, port] = host.split(":");
const projectId = "demo-drawing";
const origin = `http://${host}`;
const adminRequest = async (path, method, value) => {
  const result = await fetch(`${origin}/${path}.json?ns=${projectId}`, {
    method, headers: { Authorization: "Bearer owner", "Content-Type": "application/json" }, body: JSON.stringify(value),
  });
  assert.ok(result.ok, await result.text());
};
await adminRequest(".settings/rules", "PUT", JSON.parse(readFileSync(new URL("../security/realtime-database.rules.json", import.meta.url), "utf8")));
await adminRequest("", "PUT", { drawingAccess: { v1: { minjun: { room: { lobby: { alice: true, bob: true } } } } } });

const apps = [];
const databaseFor = (uid, tenantId = "minjun", role = "student") => {
  const app = initializeApp({ projectId, databaseURL: `${origin}?ns=${projectId}` }, `drawing-rules-${uid}-${tenantId}-${role}`);
  apps.push(app);
  const database = getDatabase(app);
  connectDatabaseEmulator(database, hostname, Number(port), { mockUserToken: { sub: uid, user_id: uid, tenantId, role, firebase: { sign_in_provider: "anonymous" } } });
  return database;
};
const alice = databaseFor("alice");
const bob = databaseFor("bob");
const intruder = databaseFor("stranger");
const otherTenant = databaseFor("alice", "hana");
const unverified = databaseFor("alice", "minjun", "guest");
const boardPath = "drawingBoards/v1/minjun/room/lobby";
const stroke = (slot, overrides = {}) => ({ by: "alice", s: slot, l: "파란 고래", c: 210, w: 6, p: "010020030040", g: 0, t: serverTimestamp(), ...overrides });
const changes = (slot = 0, overrides = {}, generation = 0) => ({ "writers/alice": { t: serverTimestamp(), g: generation }, [`strokes/alice_${slot}`]: stroke(slot, overrides) });
const reject = async (database, value) => assert.rejects(update(ref(database, boardPath), value), /permission[ _]denied/i);
try {
  await update(ref(alice, boardPath), changes());
  assert.equal((await get(ref(bob, `${boardPath}/strokes/alice_0`))).val().by, "alice", "verified classmates can see each other's strokes");
  await assert.rejects(get(ref(intruder, boardPath)), /permission[ _]denied/i);
  await assert.rejects(get(ref(otherTenant, boardPath)), /permission[ _]denied/i);
  await reject(intruder, changes(1));
  await reject(unverified, changes(1));
  await reject(bob, { "writers/bob": { t: serverTimestamp(), g: 0 }, "strokes/alice_0": null });
  await reject(alice, changes(0, { c: 40 }));
  await reject(alice, changes(1)); // server-side rate limit
  await reject(alice, { generation: 100 });
  await reject(alice, { "writers/alice": null });
  await new Promise((resolve) => setTimeout(resolve, 650));
  for (const invalid of [changes(80), changes(1, { p: "123456".repeat(193) }), changes(1, { p: "abc123" }), changes(1, { by: "bob" }), changes(1, { g: 1 }), changes(1, { extra: true }), changes(1, { w: 999 })]) await reject(alice, invalid);
  const batch = { "writers/alice": { t: serverTimestamp(), g: 0 } };
  for (let slot = 1; slot < 80; slot++) batch[`strokes/alice_${slot}`] = stroke(slot);
  await update(ref(alice, boardPath), batch);
  assert.equal(Object.keys((await get(ref(alice, `${boardPath}/strokes`))).val()).length, 80);
  await update(ref(alice, boardPath), { "writers/alice": { t: serverTimestamp(), g: 0 }, "strokes/alice_0": null });
  assert.equal((await get(ref(bob, `${boardPath}/strokes/alice_0`))).exists(), false, "own undo must propagate to classmates");
  await adminRequest(boardPath, "PUT", { generation: 1 });
  await reject(alice, changes(0));
  await reject(alice, { "writers/alice": { t: serverTimestamp(), g: 0 }, "strokes/alice_0": null });
  await update(ref(alice, boardPath), changes(0, { g: 1 }, 1));
  assert.equal((await get(ref(bob, `${boardPath}/strokes/alice_0`))).val().g, 1, "new-generation strokes must work after teacher clear");
  await reject(alice, { "writers/alice": { t: serverTimestamp(), g: 0 }, "strokes/alice_0": null });
  await assert.rejects(update(ref(alice, "drawingBoards/v1/minjun/invented/lobby"), changes()), /permission[ _]denied/i);
  console.log("collaborative drawing RTDB ownership, limits, throttle and clear-race rules passed");
} finally { await Promise.all(apps.map((app) => deleteApp(app))); }

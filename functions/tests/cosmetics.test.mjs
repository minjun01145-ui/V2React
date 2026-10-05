import assert from "node:assert/strict";
import { mock } from "node:test";
import { CATALOG, CATEGORIES, DEFAULT_APPEARANCE, DEFAULT_ITEM_IDS, automaticPrice, parseAppearance, parseShopState, publishShop, selectWeeklyItems, shopWeek, updateOverrides } from "../lib/cosmetics/model.js";
import { parseBalance } from "../lib/coins/model.js";

assert.equal(shopWeek(Date.parse("2026-10-04T14:59:59Z")), "2026-09-28");
assert.equal(shopWeek(Date.parse("2026-10-04T15:00:00Z")), "2026-10-05");
assert.equal(shopWeek(Date.parse("2026-12-31T16:00:00Z")), "2026-12-28");
assert.deepEqual(parseAppearance(DEFAULT_APPEARANCE), DEFAULT_APPEARANCE);
assert.throws(() => parseAppearance({ ...DEFAULT_APPEARANCE, items: { ...DEFAULT_APPEARANCE.items, hat: 30000 } }));
for (const balance of [NaN, -1, 0.5, "10", null]) assert.throws(() => parseBalance(balance));
let state = publishShop(null, "2026-10-05");
assert.equal(state.featuredIds.length, 8);
assert.equal(new Set(state.featuredIds.map((id) => CATALOG.find((item) => item.itemId === id).category)).size, 8);
assert.deepEqual(parseShopState(state), state);
assert.equal(publishShop(state, state.week), state, "repeated publication must preserve the teacher's next-week edits");
const next = publishShop(state, "2026-10-12");
assert.ok(next.featuredIds.every((id) => !state.featuredIds.includes(id)), "unused items must win over last week's items");
assert.deepEqual(selectWeeklyItems(state.next.week, state.lastFeatured, state.next), next.featuredIds);
const forceId = CATALOG.find((item) => !DEFAULT_ITEM_IDS.includes(item.itemId) && !next.featuredIds.includes(item.itemId)).itemId;
const excludeId = next.featuredIds[0];
state = { ...state, next: updateOverrides(updateOverrides(state.next, forceId, "feature", 77), excludeId, "exclude", null) };
const customized = publishShop(state, "2026-10-12");
assert.ok(customized.featuredIds.includes(forceId));
assert.ok(!customized.featuredIds.includes(excludeId));
assert.equal(customized.prices[forceId], 77);
assert.equal(publishShop(state, "2026-10-19").prices[forceId], 77, "a skipped scheduled run must not lose the teacher's due price change");
assert.equal(state.prices[forceId], undefined, "next week's price must not change this week's purchases");
assert.ok(CATALOG.some((item) => item.itemId === excludeId), "excluding a feature must not remove an item from regular sale");
assert.throws(() => parseShopState({ ...state, prices: { [forceId]: -1 } }));
const allUsed = Object.fromEntries(CATALOG.map((item) => [item.itemId, "2026-10-05"]));
const oldestId = CATALOG.find((item) => !DEFAULT_ITEM_IDS.includes(item.itemId)).itemId;
allUsed[oldestId] = "2026-09-01";
assert.ok(selectWeeklyItems("2026-10-12", allUsed, customized.next).includes(oldestId), "exhausted catalogs rotate least-recently featured items");
console.log("weekly character selection, no-FOMO and price rollover tests passed");

// Run the real authenticated callables with an atomic in-memory Firestore boundary.
const { db } = await import("../lib/shared/firebase.js");
const documents = new Map([
  ["studentProfiles/alice", { tenantId: "minjun", studentNumber: "1", displayName: "학생" }],
  ["studentRoster/1", { active: true, displayName: "학생" }],
  ["studentProfiles/other", { tenantId: "hana", studentNumber: "1", displayName: "학생" }],
  ["studentRoster/hana--1", { active: true, displayName: "학생" }],
  ["admins/teacher", { active: true, tenantId: "minjun" }],
  ["admins/other-teacher", { active: true, tenantId: "hana" }],
  ["admins/inactive", { active: false, tenantId: "minjun" }],
]);
const snapshot = (path) => ({ exists: documents.has(path), data: () => structuredClone(documents.get(path)) });
const reference = (path) => ({ path, collection: (name) => reference(`${path}/${name}`), doc: (id) => reference(`${path}/${id}`), get: async () => snapshot(path) });
mock.method(db, "collection", (name) => reference(name));
let queue = Promise.resolve();
mock.method(db, "runTransaction", (callback) => {
  const operation = queue.then(async () => {
    const writes = [];
    const result = await callback({
      get: async (ref) => { assert.equal(writes.length, 0, "Firestore requires all transaction reads before writes"); return snapshot(ref.path); },
      create: (ref, data) => { assert.ok(!documents.has(ref.path)); writes.push([ref.path, data]); },
      set: (ref, data, options) => writes.push([ref.path, options?.merge ? { ...documents.get(ref.path), ...data } : data]),
    });
    for (const [path, data] of writes) documents.set(path, structuredClone(data));
    return result;
  });
  queue = operation.then(() => {}, () => {});
  return operation;
});
mock.method(Date, "now", () => Date.parse("2026-10-05T03:00:00Z"));
const { initializeStudentCharacter, getCharacterShop, purchaseCharacterItem, saveStudentCharacter, getNextCharacterShop, updateNextCharacterShop } = await import("../lib/cosmetics/callables.js");
const { grantGameParticipationCoins } = await import("../lib/coins/service.js");
const alice = { uid: "alice", token: { role: "student", tenantId: "minjun", studentNumber: "1", displayName: "학생", firebase: { sign_in_provider: "anonymous" } } };
const other = { ...alice, uid: "other", token: { ...alice.token, tenantId: "hana" } };
const teacher = { uid: "teacher", token: { firebase: { sign_in_provider: "password" } } };
const call = (fn, auth = alice, data = {}) => fn.run({ auth, data });
try {
  await assert.rejects(call(initializeStudentCharacter, null), (error) => error.code === "unauthenticated");
  await assert.rejects(call(initializeStudentCharacter, { ...alice, token: { ...alice.token, tenantId: "hana" } }), (error) => error.code === "permission-denied");
  await assert.rejects(call(getNextCharacterShop), (error) => error.code === "unauthenticated");
  await assert.rejects(call(getNextCharacterShop, { ...teacher, uid: "inactive" }), (error) => error.code === "permission-denied");
  await call(initializeStudentCharacter);
  await call(initializeStudentCharacter);
  assert.deepEqual(documents.get("studentGameData/1/wardrobe/profile").appearance, DEFAULT_APPEARANCE);
  assert.equal(documents.get("studentGameData/1/cosmetics/profile").equippedKind, "maple");
  const shop = await call(getCharacterShop);
  const item = shop.items.find((entry) => entry.onSale && entry.price === 10);
  const input = { itemId: item.itemId, expectedPrice: item.price, accountId: "hana--1", balance: 9999 };
  await assert.rejects(call(purchaseCharacterItem, alice, input), /부족/);
  const appearance = { ...DEFAULT_APPEARANCE, items: { ...DEFAULT_APPEARANCE.items, [item.category]: item.itemId } };
  await assert.rejects(call(saveStudentCharacter, alice, { appearance }), /먼저 구매/);
  const reward = { studentNumber: "1", displayName: "학생" };
  const grants = await Promise.all(Array.from({ length: 5 }, () => grantGameParticipationCoins("minjun", "room", "round", reward)));
  assert.equal(grants.filter(Boolean).length, 1, "repeated/concurrent reward delivery grants once per account and round");
  assert.equal(documents.get("studentGameData/1/wallet/v2coins").balance, 10);
  const purchases = await Promise.all(Array.from({ length: 5 }, () => call(purchaseCharacterItem, alice, input)));
  assert.equal(purchases.filter((result) => result.purchased).length, 1);
  assert.equal(documents.get("studentGameData/1/wallet/v2coins").balance, 0);
  assert.equal(documents.has("studentGameData/hana--1/wallet/v2coins"), false, "client-supplied account IDs must be ignored");
  await call(saveStudentCharacter, alice, { appearance });
  await call(initializeStudentCharacter);
  assert.deepEqual(documents.get("studentGameData/1/wardrobe/profile").appearance, appearance, "login/refresh must retain the saved outfit");
  assert.deepEqual(documents.get("studentGameData/1/cosmetics/profile").avatar, { kind: "maple", appearance });
  documents.delete("studentGameData/1/cosmetics/profile");
  await call(initializeStudentCharacter);
  assert.deepEqual(documents.get("studentGameData/1/cosmetics/profile").avatar, { kind: "maple", appearance }, "missing avatar profiles must recover the saved outfit");
  assert.equal((await call(purchaseCharacterItem, alice, input)).purchased, false, "lost response retries must not charge twice");
  await call(initializeStudentCharacter, other);
  assert.deepEqual(documents.get("studentGameData/hana--1/wardrobe/profile").appearance, DEFAULT_APPEARANCE);
  await assert.rejects(call(saveStudentCharacter, other, { appearance }), /먼저 구매/);
  const legacy = { equippedKind: "character", equippedCharacterId: "old" };
  documents.set("studentGameData/1/cosmetics/profile", legacy);
  await call(initializeStudentCharacter);
  assert.deepEqual(documents.get("studentGameData/1/cosmetics/profile"), legacy, "migration must preserve existing avatars");
  const adminShop = await call(getNextCharacterShop, teacher);
  for (const price of [-1, 0, 1.1, 10_001, "10"]) await assert.rejects(call(updateNextCharacterShop, teacher, { week: adminShop.next.week, itemId: item.itemId, mode: "feature", price }), (error) => error.code === "invalid-argument");
  await assert.rejects(call(updateNextCharacterShop, teacher, { week: adminShop.week, itemId: item.itemId, mode: "feature", price: 11 }), /변경/);
  const edited = await call(updateNextCharacterShop, teacher, { week: adminShop.next.week, itemId: item.itemId, mode: "feature", price: 11 });
  assert.ok(edited.nextFeaturedIds.includes(item.itemId));
  assert.equal(edited.items.find((entry) => entry.itemId === item.itemId).price, 10);
  assert.equal(edited.next.prices[item.itemId], 11);
  const secondTenantShop = await call(getNextCharacterShop, { ...teacher, uid: "other-teacher" });
  assert.deepEqual(secondTenantShop.next.prices, {}, "teachers must only edit their own tenant's weekly shop");
  assert.deepEqual(CATEGORIES, ["hair", "face", "hat", "top", "bottom", "shoes", "accessory", "weapon"]);
  assert.ok(CATALOG.every((entry) => Number.isSafeInteger(automaticPrice(entry.itemId))));
} finally { mock.restoreAll(); }
console.log("student default → game coins → concurrent purchase → equip/save → reload, authentication and tenant tests passed");

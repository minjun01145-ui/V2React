import assert from "node:assert/strict";
import { mock } from "node:test";

const documents = new Map();
const listeners = new Map();
mock.module("firebase/firestore", { namedExports: {
  doc: (_db, ...parts) => parts.join("/"),
  setDoc: async (path, data, options) => {
    documents.set(path, options?.merge ? { ...documents.get(path), ...data } : data);
    for (const callback of listeners.get(path) ?? []) callback({ data: () => documents.get(path) });
  },
  onSnapshot: (path, callback) => {
    const callbacks = listeners.get(path) ?? new Set();
    callbacks.add(callback);
    listeners.set(path, callbacks);
    callback({ data: () => documents.get(path) });
    return () => callbacks.delete(callback);
  },
} });
mock.module("../src/firebase/firebaseClient.ts", { namedExports: { db: {} } });
try {
  const { saveTheme, saveAppFont, subscribeAppearance } = await import("../src/fonts/repository.ts");
  const teacher = [], student = [], otherTenant = [];
  const onError = (error) => { throw error; };
  const stopTeacher = subscribeAppearance("minjun", value => teacher.push(value), onError);
  const stopStudent = subscribeAppearance("minjun", value => student.push(value), onError);
  const stopOther = subscribeAppearance("hana", value => otherTenant.push(value), onError);
  assert.deepEqual(student.at(-1), { themeId: "classic", fontId: "default" });
  await saveTheme("minjun", "arcade");
  assert.deepEqual(student.at(-1), { themeId: "arcade", fontId: "default" });
  await saveAppFont("minjun", "jua");
  assert.deepEqual(student.at(-1), { themeId: "arcade", fontId: "jua" }, "font saves preserve the theme");
  await saveTheme("minjun", "paper");
  assert.deepEqual(student.at(-1), { themeId: "paper", fontId: "default" }, "a theme switch resets its font atomically");
  assert.deepEqual(student, teacher, "both clients observe the same appearance changes");
  assert.equal(otherTenant.length, 1, "another tenant is unaffected");
  stopStudent(); stopTeacher(); stopOther();
  const count = student.length;
  await saveTheme("minjun", "space");
  assert.equal(student.length, count, "unmounted clients stop receiving updates");
  documents.set("tenants/minjun/settings/appearance", { themeId: "invalid", fontId: {} });
  const stopInvalid = subscribeAppearance("minjun", value => assert.deepEqual(value, { themeId: "classic", fontId: "default" }), onError);
  stopInvalid();
} finally { mock.restoreAll(); }
console.log("appearance persistence, live subscriptions and tenant isolation tests passed");

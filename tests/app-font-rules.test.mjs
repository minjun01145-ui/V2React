// Isolated emulator only; never contact the live project.
import assert from "node:assert/strict";
const host = process.env.FIRESTORE_EMULATOR_HOST;
assert.match(host ?? "", /^(127\.0\.0\.1|localhost):\d+$/, "Start the local Firestore emulator.");
const project = "demo-slide-question";
const base = `http://${host}/v1/projects/${project}/databases/(default)/documents`;
const encode = (data) => ({ fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, typeof value === "string" ? { stringValue: value } : typeof value === "boolean" ? { booleanValue: value } : { integerValue: String(value) }])) });
const jwt = (uid, tenantId) => `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: uid, user_id: uid, aud: project, iss: `https://securetoken.google.com/${project}`, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, tenantId, firebase: { sign_in_provider: "password" } })).toString("base64url")}.`;
const request = (path, method = "GET", data, token) => fetch(`${base}/${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" }, ...(data ? { body: JSON.stringify(encode(data)) } : {}) });
for (const [uid, tenantId, active] of [["font-teacher", "minjun", true], ["font-hana", "hana", true], ["font-inactive", "minjun", false]]) {
  const response = await request(`admins/${uid}`, "PATCH", { tenantId, active }, "owner");
  assert.equal(response.status, 200, await response.text());
}
const teacher = jwt("font-teacher", "minjun");
const hana = jwt("font-hana", "hana");
const student = jwt("font-student", "minjun");
const path = "tenants/minjun/settings/appearance";
assert.equal((await request(path)).status, 404, "login screens can read a missing preference and use default");
assert.equal((await request(path, "PATCH", { fontId: "jua" }, teacher)).status, 200, "tenant teacher can save");
assert.equal((await request(path)).status, 200, "public appearance is available before student login");
assert.equal((await request(path, "GET", undefined, student)).status, 200);
for (const themeId of ["classic", "candy", "forest", "ocean"]) {
  assert.equal((await request(path, "PATCH", { fontId: "default", themeId }, teacher)).status, 200, "teacher can select a theme");
  assert.equal((await request(path, "PATCH", { fontId: "jua", themeId }, teacher)).status, 200, "custom fonts coexist with themes");
  assert.equal((await request(path, "PATCH", { fontId: "default", themeId }, student)).status, 403, "students cannot change the theme");
  assert.equal((await request(path, "PATCH", { fontId: "default", themeId }, hana)).status, 403, "themes stay tenant scoped");
}
for (const themeId of ["unknown", "", 42, "__proto__", "arcade"]) {
  assert.equal((await request(path, "PATCH", { fontId: "default", themeId }, teacher)).status, 403, "unknown themes are rejected");
}
for (const token of [undefined, student, hana, jwt("font-inactive", "minjun")]) {
  assert.equal((await request(path, "PATCH", { fontId: "pretendard" }, token)).status, 403, "only active same-tenant teachers can write");
  assert.equal((await request(path, "DELETE", undefined, token)).status, 403, "only active same-tenant teachers can reset");
}
for (const data of [{ fontId: 42 }, { fontId: "" }, { fontId: "x".repeat(65) }, { fontId: "jua", secret: "not-public" }, {}]) {
  assert.equal((await request(path, "PATCH", data, teacher)).status, 403, "only a bounded font id is public");
}
assert.equal((await request("tenants/minjun/settings", "GET", undefined, teacher)).status, 403, "other settings cannot be listed");
assert.equal((await request("tenants/minjun/settings/private")).status, 403, "other settings are not public");
assert.equal((await request("tenants/unknown/settings/appearance")).status, 403, "unknown tenants are not public");
assert.equal((await request("tenants/hana/settings/appearance", "PATCH", { fontId: "pretendard" }, hana)).status, 200, "secondary tenant can set its own font");
assert.equal((await request("tenants/hana/settings/appearance", "PATCH", { fontId: "jua" }, teacher)).status, 403, "primary teacher cannot modify another tenant");
assert.equal((await request(path, "PATCH", { fontId: "default" }, teacher)).status, 200, "default can be persisted");
assert.equal((await request(path, "DELETE", undefined, teacher)).status, 200, "teacher can remove the preference");
console.log("app font rules: public appearance, teacher writes, tenant isolation and payload constraints passed");

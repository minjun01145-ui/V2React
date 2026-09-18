import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const violations = [];
// Keep this checker focused on repository-wide trust boundaries. Feature-specific
// data shapes and game integrity belong in their rules or focused feature tests.

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function matchBlock(source, collectionName) {
  const header = new RegExp(`match\\s+\\/${collectionName}\\/\\{[A-Za-z][A-Za-z0-9_]*\\}\\s*\\{`).exec(source);
  if (!header) return "";
  const start = header.index + header[0].lastIndexOf("{");
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start + 1, index);
  }
  return "";
}

function writeClauses(block) {
  const clauses = [];
  const allowPattern = /allow\s+([^:;{}]+):\s*if\s+([^;]+);/g;
  for (const match of block.matchAll(allowPattern)) {
    const operations = match[1].split(",").map((operation) => operation.trim());
    const condition = match[2];
    const canWrite = operations.some((operation) => ["write", "create", "update", "delete"].includes(operation));
    if (canWrite) clauses.push(condition);
  }
  return clauses;
}

function isAdminOnlyOrDenied(condition) {
  const normalized = condition.trim();
  return normalized === "false" || (normalized.includes("isAdmin()") && !normalized.includes("||"));
}

const envExample = read(".env.example");

const gitignore = read(".gitignore");
if (!gitignore.includes(".env.local") || !gitignore.includes("functions/lib/")) {
  violations.push(".gitignore: local environment files and built server artifacts must not be committed");
}
const clientFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) clientFiles.push(full);
  }
}
walk(path.join(root, "src"));

if (/VITE_[A-Z0-9_]*(PASSWORD|SECRET|PRIVATE_KEY)/.test(envExample)) {
  violations.push(".env.example: secrets/passwords must never use VITE_ variables because Vite exposes them to the browser");
}

for (const file of clientFiles) {
  const source = fs.readFileSync(file, "utf8");
  const rel = path.relative(root, file).replaceAll(path.sep, "/");
  if (/VITE_[A-Z0-9_]*(PASSWORD|SECRET|PRIVATE_KEY)/.test(source)) {
    violations.push(`${rel}: browser code must not reference VITE password/secret/private-key variables`);
  }
}

const teacherAuth = read("src/auth/teacherAuth.ts");
if (!teacherAuth.includes("signInWithEmailAndPassword") || !teacherAuth.includes('doc(db, "admins", uid)')) {
  violations.push("src/auth/teacherAuth.ts: teacher login must use Firebase Auth and verify the admins allow-list");
}

// Student auth flow and PIN hashing are behavior/structure contracts covered by
// tests/student-auth-contract.test.mjs and functions/tests/pin.test.mjs.

// Emulator-backed rules tests are not currently installed. Keep fast repository-level
// invariants here, but scope collection policies to their own match blocks so an
// unrelated `allow ... if false` cannot make a protected collection appear secure.
const rules = withoutComments(read("security/firestore.rules.secure"));
if (/allow\s+[^:;{}]+:\s*if\s+true\s*;/.test(rules)) {
  violations.push("security/firestore.rules.secure: public allow rules are forbidden");
}
const adminRules = matchBlock(rules, "admins");
const studentProfileRules = matchBlock(rules, "studentProfiles");
if (!/allow\s+read\s*:\s*if\s+signedIn\(\)\s*&&\s*\(request\.auth\.uid\s*==\s*uid\s*\|\|\s*isAdmin\(\)\)\s*;/.test(adminRules)
  || !/allow\s+write\s*:\s*if\s+false\s*;/.test(adminRules)
  || !/allow\s+read\s*:\s*if\s+signedIn\(\)\s*&&\s*\(request\.auth\.uid\s*==\s*uid\s*\|\|\s*isAdmin\(\)\)\s*;/.test(studentProfileRules)
  || !/allow\s+write\s*:\s*if\s+false\s*;/.test(studentProfileRules)) {
  violations.push("security/firestore.rules.secure: expected authenticated ownership/admin checks are missing");
}
if (!rules.includes("documents/studentProfiles/$(request.auth.uid)).data.studentNumber == request.auth.token.studentNumber")
  || !rules.includes("documents/studentProfiles/$(request.auth.uid)).data.displayName == request.auth.token.displayName")) {
  violations.push("security/firestore.rules.secure: student claims must be bound to the server-owned UID profile");
}
if (rules.includes("documents/studentRoster/$(request.auth.token.studentNumber)).data.displayName == request.auth.token.displayName")) {
  violations.push("security/firestore.rules.secure: normalized student claims must not be compared with unnormalized roster names");
}
const denyAll = /allow\s+read\s*,\s*write\s*:\s*if\s+false\s*;/;
if (!denyAll.test(matchBlock(rules, "studentPinCredentials"))) {
  violations.push("security/firestore.rules.secure: student PIN credentials must be inaccessible to browser clients");
}
if (!denyAll.test(matchBlock(rules, "aiProviderConfigs"))) {
  violations.push("security/firestore.rules.secure: AI provider settings must be inaccessible to browser clients");
}
if (!rules.includes("match /learningSets/{setId}") || !rules.includes("publicLearningSetRead()") || !rules.includes("allow create, update, delete: if isAdmin()")) {
  violations.push("security/firestore.rules.secure: learning sets must be public-read and admin-write");
}
if (!rules.includes("match /quizGamePlans/{planId}") || !rules.includes("allow read, create, update, delete: if isAdmin()")) {
  violations.push("security/firestore.rules.secure: quiz game plans must be admin-only");
}

const aiCallables = read("functions/src/ai/callables.ts");
const aiSecretStore = read("functions/src/ai/secretStore.ts");
if (!aiCallables.includes("requireAdmin(request)")) {
  violations.push("functions/src/ai/callables.ts: every AI administration callable must require an administrator");
}
if (!aiSecretStore.includes("SecretManagerServiceClient") || !aiSecretStore.includes("addSecretVersion")) {
  violations.push("functions/src/ai/secretStore.ts: AI API keys must be stored in Google Secret Manager");
}
for (const file of clientFiles) {
  const source = fs.readFileSync(file, "utf8");
  const rel = path.relative(root, file).replaceAll(path.sep, "/");
  if (/OLLAMA_API_KEY|jurye-ollama-cloud-api-key/.test(source)) {
    violations.push(`${rel}: browser code must not know the AI secret name or environment variable`);
  }
}

const multiplayerTestCallables = read("functions/src/multiplayer-test/callables.ts");
if ((multiplayerTestCallables.match(/requireAdmin\(request\)/g) ?? []).length < 2) {
  violations.push("functions/src/multiplayer-test/callables.ts: test session creation and cleanup must both require an administrator");
}
if (!multiplayerTestCallables.includes("requireAnonymous(request)")) {
  violations.push("functions/src/multiplayer-test/callables.ts: test student joining must start from an isolated anonymous Firebase user");
}
if (!rules.includes('request.auth.token.testRoomId == roomId') || !rules.includes('data.testOwnerUid == request.auth.token.testOwnerUid') || !rules.includes('data.expiresAt > request.time')) {
  violations.push("security/firestore.rules.secure: test students must be restricted to their administrator-owned test room");
}
if (!denyAll.test(matchBlock(rules, "multiplayerTestRuns"))) {
  violations.push("security/firestore.rules.secure: multiplayer test run credentials must be server-only");
}

for (const collectionName of ["players", "waitingDiceRequests", "readiness", "participants", "progress"]) {
  const block = matchBlock(rules, collectionName);
  const clauses = writeClauses(block);
  if (clauses.length === 0 || clauses.some((condition) => !condition.includes("request.auth.uid == uid") && !isAdminOnlyOrDenied(condition))) {
    violations.push(`security/firestore.rules.secure: student writes to ${collectionName} must be scoped to the authenticated UID`);
  }
}

if (violations.length) {
  console.error("Security checks failed:\n" + violations.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log("security checks passed");

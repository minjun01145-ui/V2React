import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const violations = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
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

const studentAuth = read("src/auth/studentAuth.ts");
if (!studentAuth.includes("signInAnonymously") || !studentAuth.includes("prepareStudentLogin") || !studentAuth.includes("completeStudentLogin")) {
  violations.push("src/auth/studentAuth.ts: student identity must use anonymous Firebase Auth plus the two-step server login functions");
}

const teacherAuth = read("src/auth/teacherAuth.ts");
if (!teacherAuth.includes("signInWithEmailAndPassword") || !teacherAuth.includes('doc(db, "admins", uid)')) {
  violations.push("src/auth/teacherAuth.ts: teacher login must use Firebase Auth and verify the admins allow-list");
}

const functionSource = read("functions/src/student-auth/callables.ts");
const pinSource = read("functions/src/student-auth/pin.ts");
if (!functionSource.includes('collection("studentRoster")') || !functionSource.includes('collection("studentProfiles")')) {
  violations.push("functions/src/student-auth/callables.ts: student credentials must be verified server-side against studentRoster");
}
if (!pinSource.includes("scryptSync") || !pinSource.includes("timingSafeEqual")) {
  violations.push("functions/src/student-auth/pin.ts: student PINs must use salted hashing and constant-time comparison");
}

const rules = read("security/firestore.rules.secure");
if (/allow\s+(read|write|read,\s*write)\s*:\s*if\s+true/.test(rules)) {
  violations.push("security/firestore.rules.secure: public allow rules are forbidden");
}
if (!rules.includes("studentProfiles") || !rules.includes("admins") || !rules.includes("request.auth.uid")) {
  violations.push("security/firestore.rules.secure: expected authenticated ownership/admin checks are missing");
}
if (!rules.includes("studentPinCredentials") || !rules.includes("allow read, write: if false")) {
  violations.push("security/firestore.rules.secure: student PIN credentials must be inaccessible to browser clients");
}
if (!rules.includes("aiProviderConfigs") || !rules.includes("allow read, write: if false")) {
  violations.push("security/firestore.rules.secure: AI provider settings must be inaccessible to browser clients");
}
if (!rules.includes("match /learningSets/{setId}") || !rules.includes("publicLearningSetRead()") || !rules.includes("allow create, update, delete: if isAdmin()")) {
  violations.push("security/firestore.rules.secure: learning sets must be public-read and admin-write");
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
const testStudentViewport = read("src/features/teacher/test-tool/TestStudentViewport.tsx");
const multiplayerProgressRepository = read("src/multiplayer/game-progress/repository.ts");
if ((multiplayerTestCallables.match(/requireAdmin\(request\)/g) ?? []).length < 2) {
  violations.push("functions/src/multiplayer-test/callables.ts: test session creation and cleanup must both require an administrator");
}
if (!multiplayerTestCallables.includes("requireAnonymous(request)")) {
  violations.push("functions/src/multiplayer-test/callables.ts: test student joining must start from an isolated anonymous Firebase user");
}
if (!rules.includes('request.auth.token.testRoomId == roomId') || !rules.includes('data.testOwnerUid == request.auth.token.testOwnerUid') || !rules.includes('data.expiresAt > request.time')) {
  violations.push("security/firestore.rules.secure: test students must be restricted to their administrator-owned test room");
}
if (!rules.includes("match /participants/{uid}") || !rules.includes("activeRound(roomId, roundId)") || !rules.includes('affectedKeys().hasOnly(["nickname"])')) {
  violations.push("security/firestore.rules.secure: round participants must be round-scoped, self-owned, and identity-immutable");
}
if (!/match \/players\/\{uid\}[\s\S]*?allow read: if isAdmin\(\) \|\| isRoomStudent\(roomId\);/.test(rules)) {
  violations.push("security/firestore.rules.secure: room students must be able to query the lobby player roster");
}
if (!rules.includes("match /multiplayerTestRuns/{adminUid}")) {
  violations.push("security/firestore.rules.secure: multiplayer test run credentials must be server-only");
}
if (!rules.includes('"correctCount", "attemptCount", "combo"') || !rules.includes("request.resource.data.combo is int")) {
  violations.push("security/firestore.rules.secure: multiplayer progress must explicitly allow and validate combo state");
}
if (!rules.includes("match /operations/{uid}/items/{operationId}")
  || !rules.includes("request.resource.data.lastOperationId")
  || !rules.includes("request.resource.data.revision == resource.data.revision + 1")
  || !rules.includes("getAfter(")) {
  violations.push("security/firestore.rules.secure: progress writes must be linked to an immutable, revisioned operation");
}
if (!multiplayerProgressRepository.includes("runTransaction")
  || !multiplayerProgressRepository.includes("operationSnapshot.exists()")
  || !multiplayerProgressRepository.includes("mergeProgressTransition")) {
  violations.push("src/multiplayer/game-progress/repository.ts: attempts and progress must use one idempotent transaction");
}
if (!rules.includes("match /studentGameData/{accountId}/games/pokemon-catch") || !rules.includes("validPokemonInventory")) {
  violations.push("security/firestore.rules.secure: persistent Pokémon data must validate authenticated ownership and inventory shape");
}
if (!testStudentViewport.includes('sandbox="allow-scripts allow-same-origin allow-forms"')) {
  violations.push("src/features/teacher/test-tool/TestStudentViewport.tsx: sandboxed test students must allow in-frame forms");
}

if (violations.length) {
  console.error("Security checks failed:\n" + violations.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log("security checks passed");

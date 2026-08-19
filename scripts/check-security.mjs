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
if (!studentAuth.includes("signInAnonymously") || !studentAuth.includes("claimStudentIdentity")) {
  violations.push("src/auth/studentAuth.ts: student identity must use anonymous Firebase Auth plus the server-side claim function");
}

const teacherAuth = read("src/auth/teacherAuth.ts");
if (!teacherAuth.includes("signInWithEmailAndPassword") || !teacherAuth.includes('doc(db, "admins", uid)')) {
  violations.push("src/auth/teacherAuth.ts: teacher login must use Firebase Auth and verify the admins allow-list");
}

const functionSource = read("functions/src/index.ts");
if (!functionSource.includes('collection("studentRoster")') || !functionSource.includes('collection("studentProfiles")')) {
  violations.push("functions/src/index.ts: student credentials must be verified server-side against studentRoster");
}

const rules = read("security/firestore.rules.secure");
if (/allow\s+(read|write|read,\s*write)\s*:\s*if\s+true/.test(rules)) {
  violations.push("security/firestore.rules.secure: public allow rules are forbidden");
}
if (!rules.includes("studentProfiles") || !rules.includes("admins") || !rules.includes("request.auth.uid")) {
  violations.push("security/firestore.rules.secure: expected authenticated ownership/admin checks are missing");
}

if (violations.length) {
  console.error("Security checks failed:\n" + violations.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log("security checks passed");

import { spawnSync } from "node:child_process";

const target = process.argv[2];
const only = { hosting: "hosting", functions: "functions:jurye-v2", rules: "firestore:rules" }[target];
if (!only) throw new Error("배포 대상은 hosting, functions, rules 중 하나여야 합니다.");
// npm and Firebase install .cmd entry points on Windows. Arguments are fixed above.
const windows = process.platform === "win32";
function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: windows });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (target !== "rules") {
  const args = target === "functions" ? ["run", "build", "--prefix", "functions"] : ["run", "build"];
  const buildStatus = run(windows ? "npm.cmd" : "npm", args);
  if (buildStatus !== 0) process.exit(buildStatus);
}
process.exitCode = run(windows ? "firebase.cmd" : "firebase", ["deploy", "--only", only]);

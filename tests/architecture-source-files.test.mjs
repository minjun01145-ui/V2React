import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { collectApplicationSourceFiles } from "../scripts/architecture-source-files.mjs";

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "v2react-architecture-"));

try {
  fs.mkdirSync(path.join(fixtureRoot, "nested"));
  for (const file of ["app.ts", "view.tsx", "legacy.js", "nested/legacy.jsx", "styles.css", "image.png"]) {
    fs.writeFileSync(path.join(fixtureRoot, file), "");
  }

  const result = collectApplicationSourceFiles(fixtureRoot);
  const relative = (files) => files.map((file) => path.relative(fixtureRoot, file).replaceAll(path.sep, "/")).sort();

  assert.deepEqual(relative(result.javaScriptFiles), ["legacy.js", "nested/legacy.jsx"]);
  assert.deepEqual(relative(result.typeScriptFiles), ["app.ts", "view.tsx"]);
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log("architecture source file collection tests passed");

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const forbiddenSource = path.join(repositoryRoot, "src", "__architecture_test_fixture__.js");
try {
  fs.writeFileSync(forbiddenSource, "export const legacy = true;\n");
  const check = spawnSync(process.execPath, ["scripts/check-architecture.mjs"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  assert.notEqual(check.status, 0, "architecture check must fail when src contains JavaScript");
  assert.match(check.stderr, /__architecture_test_fixture__\.js: application source must use \.ts\/\.tsx/);
} finally {
  fs.rmSync(forbiddenSource, { force: true });
}

console.log("architecture JavaScript rejection test passed");

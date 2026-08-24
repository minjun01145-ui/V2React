import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const functionsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(functionsRoot, "src");

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const files = walk(srcRoot).filter((file) => file.endsWith(".ts"));
const graph = new Map(files.map((file) => [file, []]));
const importPattern = /(?:import|export)\s+(?:[^"']+?\s+from\s+)?["']([^"']+)["']/g;

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    if (!specifier?.startsWith(".")) continue;
    const resolved = path.resolve(path.dirname(file), specifier.replace(/\.js$/, ".ts"));
    if (graph.has(resolved)) graph.get(file).push(resolved);
  }
}

const visiting = new Set();
const visited = new Set();
function visit(file, trail) {
  if (visiting.has(file)) assert.fail(`Circular dependency: ${[...trail, file].map((item) => path.relative(srcRoot, item)).join(" -> ")}`);
  if (visited.has(file)) return;
  visiting.add(file);
  for (const dependency of graph.get(file)) visit(dependency, [...trail, file]);
  visiting.delete(file);
  visited.add(file);
}

for (const file of files) visit(file, []);

const aiRoot = path.join(srcRoot, "ai");
const aiSources = walk(aiRoot).filter((file) => file.endsWith(".ts"));
for (const file of aiSources) {
  const relative = path.relative(aiRoot, file).replaceAll(path.sep, "/");
  const source = fs.readFileSync(file, "utf8");
  if (relative !== "callables.ts") assert.equal(source.includes("/v2/https"), false, `${relative} must not depend on callable transport`);
  if (relative === "types.ts") assert.equal([...source.matchAll(importPattern)].length, 0, "AI types must remain dependency-free");
}

console.log("Functions architecture tests passed");

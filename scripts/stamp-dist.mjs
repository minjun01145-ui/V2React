import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const distRoot = path.resolve(process.cwd(), "dist");
const stamp = crypto.randomUUID();
const textExtensions = new Set([".css", ".html", ".js"]);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

if (!fs.existsSync(path.join(distRoot, "index.html"))) {
  throw new Error("dist/index.html is required before stamping deployment assets.");
}

let stampedCount = 0;
for (const file of walk(distRoot)) {
  if (!textExtensions.has(path.extname(file))) continue;
  const relativePath = path.relative(distRoot, file).replaceAll(path.sep, "/");
  fs.appendFileSync(file, `\n/* deploy:${stamp}:${relativePath} */\n`, "utf8");
  stampedCount += 1;
}

console.log(`stamped ${stampedCount} deployment assets`);

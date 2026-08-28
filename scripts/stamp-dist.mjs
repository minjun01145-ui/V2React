import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const distRoot = path.resolve(process.cwd(), "dist");
const stamp = crypto.randomUUID().slice(0, 8);
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

const originalFiles = walk(distRoot);
const assetRenames = originalFiles
  .filter((file) => file.startsWith(path.join(distRoot, "assets")) && textExtensions.has(path.extname(file)))
  .map((file) => {
    const extension = path.extname(file);
    const renamedFile = file.slice(0, -extension.length) + `.deploy-${stamp}${extension}`;
    return { file, renamedFile, originalName: path.basename(file), renamedName: path.basename(renamedFile) };
  });

let stampedCount = 0;
for (const file of originalFiles.filter((candidate) => textExtensions.has(path.extname(candidate)))) {
  const extension = path.extname(file);
  if (!textExtensions.has(path.extname(file))) continue;
  const relativePath = path.relative(distRoot, file).replaceAll(path.sep, "/");
  let source = fs.readFileSync(file, "utf8");
  for (const rename of assetRenames) source = source.replaceAll(rename.originalName, rename.renamedName);
  const marker = extension === ".html"
    ? `<!-- deploy:${stamp}:${relativePath} -->`
    : `/* deploy:${stamp}:${relativePath} */`;
  fs.writeFileSync(file, `${source}\n${marker}\n`, "utf8");
  stampedCount += 1;
}

for (const rename of assetRenames) fs.renameSync(rename.file, rename.renamedFile);

console.log(`stamped ${stampedCount} deployment files and versioned ${assetRenames.length} assets`);

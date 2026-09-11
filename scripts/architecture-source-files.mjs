import fs from "node:fs";
import path from "node:path";

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

export function collectApplicationSourceFiles(srcRoot) {
  const files = walk(srcRoot);
  return {
    javaScriptFiles: files.filter((file) => /\.(js|jsx)$/.test(file)),
    typeScriptFiles: files.filter((file) => /\.(ts|tsx)$/.test(file)),
  };
}

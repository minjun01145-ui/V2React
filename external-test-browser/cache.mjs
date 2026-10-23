import { lstatSync, readdirSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";

// Only disposable Chromium caches belong here. Cookies, IndexedDB, localStorage,
// service workers, dictionaries and remembered-logins must survive cleanup.
const CACHE_DIRECTORIES = [
  "Cache", "Code Cache", "GPUCache", "DawnGraphiteCache", "DawnWebGPUCache",
  "GrShaderCache", "ShaderCache", "Media Cache", "Shared Dictionary",
];

function entries(path) {
  try {
    if (lstatSync(path).isSymbolicLink()) return [];
    return readdirSync(path, { withFileTypes: true });
  }
  catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function removeDirectory(root, name) {
  const absoluteRoot = resolve(root);
  const target = resolve(absoluteRoot, name);
  if (!target.startsWith(`${absoluteRoot}${sep}`)) throw new Error("Cache path outside its root");
  rmSync(target, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 });
}

export function clearInstallCache(appRoot) {
  // Call only after Electron has started successfully: the extracted runtime
  // is in node_modules; the download ZIP (including old versions) is redundant.
  removeDirectory(appRoot, join(".cache", "electron"));
}

export function clearProfileCache(profilePath) {
  // Run before app.ready, after acquiring the single-instance lock, so no
  // Chromium session in this profile has opened its cache files yet.
  const sessionRoots = [profilePath, ...entries(join(profilePath, "Partitions"))
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(profilePath, "Partitions", entry.name))];
  for (const root of sessionRoots) {
    for (const name of CACHE_DIRECTORIES) removeDirectory(root, name);
  }
}

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { clearInstallCache, clearProfileCache } from "../cache.mjs";

const testRoot = resolve(import.meta.dirname, "..", ".test-profile");
mkdirSync(testRoot, { recursive: true });

function fixture(t) {
  const root = mkdtempSync(join(testRoot, "cache-"));
  t.after(() => {
    assert.ok(root.startsWith(`${testRoot}${sep}`));
    rmSync(root, { recursive: true, force: true });
  });
  return root;
}

function file(root, name, value = "keep") {
  const path = join(root, name);
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, value);
  return path;
}

test("runtime download archives are removed while the installed runtime and profiles remain intact", (t) => {
  const root = fixture(t);
  file(root, ".cache/electron/old/electron.zip");
  file(root, ".cache/electron/current/electron.zip");
  const retained = ["node_modules/electron/dist/electron.exe", ".cache/npm/package", ".profile/remembered-logins/login.bin"];
  for (const name of retained) file(root, name);
  clearInstallCache(root);
  clearInstallCache(root); // Also safe after the first successful cleanup.
  assert.equal(existsSync(join(root, ".cache/electron")), false);
  for (const name of retained) assert.equal(readFileSync(join(root, name), "utf8"), "keep");
});

test("even small caches are removed and repeated cleanup works without a profile", (t) => {
  const root = fixture(t);
  const cache = file(root, "Partitions/classroom-teacher/Cache/Cache_Data/resource", "cached game");
  clearProfileCache(root);
  clearProfileCache(root);
  assert.equal(existsSync(cache), false);
  clearProfileCache(join(root, "missing-profile"));
});

test("all session caches are cleared without removing login or site data or touching another console", (t) => {
  const root = fixture(t);
  const profiles = [".profile", ".profile-hana"];
  const sessions = ["", ...["teacher", "9991", "9992", "9993"].map((id) => `Partitions/classroom-${id}`)];
  const retained = [];
  for (const profile of profiles) {
    retained.push(file(root, `${profile}/remembered-logins/login.bin`, Buffer.from([0, 255, 8, 12])));
    retained.push(file(root, `${profile}/Dictionaries/ko.bdic`));
    retained.push(file(root, `${profile}/Preferences`));
    for (const session of sessions) {
      for (const name of ["Network/Cookies", "IndexedDB/auth/000001.ldb", "Local Storage/leveldb/000001.ldb", "Session Storage/000001.ldb", "Service Worker/CacheStorage/data"]) {
        retained.push(file(root, `${profile}/${session}/${name}`));
      }
      for (const cache of ["Cache", "Code Cache", "GPUCache", "DawnGraphiteCache", "DawnWebGPUCache", "GrShaderCache", "ShaderCache", "Media Cache", "Shared Dictionary"]) {
        file(root, `${profile}/${session}/${cache}/generated`);
      }
    }
  }
  const before = retained.map((path) => readFileSync(path));
  clearProfileCache(join(root, ".profile"));
  for (const session of sessions) {
    assert.equal(existsSync(join(root, ".profile", session, "Cache")), false);
    assert.equal(existsSync(join(root, ".profile", session, "Code Cache")), false);
    assert.equal(existsSync(join(root, ".profile-hana", session, "Cache")), true);
  }
  clearProfileCache(join(root, ".profile"));
  clearProfileCache(join(root, ".profile-hana"));
  retained.forEach((path, index) => assert.deepEqual(readFileSync(path), before[index]));
});

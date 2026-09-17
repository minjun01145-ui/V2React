import assert from "node:assert/strict";
import { buildTeacherBgmCatalog, pickRandomTrack } from "../src/features/teacher/bgm/model.ts";

const catalog = buildTeacherBgmCatalog({
  "/src/assets/bgm/game10.mp3": "/assets/game10.hash.mp3",
  "/src/assets/bgm/lobby2.mp3": "/assets/lobby2.hash.mp3",
  "/src/assets/bgm/game1.mp3": "/assets/game1.hash.mp3",
  "/src/assets/bgm/lobby1.mp3": "/assets/lobby1.hash.mp3",
  "/src/assets/bgm/game1(1).mp3": "/assets/ignored.mp3",
  "/src/assets/bgm/readme.txt": "/assets/readme.txt",
});

assert.deepEqual(catalog.lobby, ["/assets/lobby1.hash.mp3", "/assets/lobby2.hash.mp3"]);
assert.deepEqual(catalog.game, ["/assets/game1.hash.mp3", "/assets/game10.hash.mp3"]);
assert.equal(pickRandomTrack(catalog.game, () => 0), "/assets/game1.hash.mp3");
assert.equal(pickRandomTrack(catalog.game, () => 0.999), "/assets/game10.hash.mp3");
assert.equal(pickRandomTrack([], () => 0.5), null);

console.log("teacher BGM catalog tests passed");

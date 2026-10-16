import assert from "node:assert/strict";
import { CLIMB_PLAYER_HEIGHT } from "../../src/game-engine/jump-tower/course.ts";
import { ARENA_PUSHERS, ARENA_WIDTH, arenaCourse, arenaSpawnPoint, pusherExtension, pusherSpan } from "../../src/games/lobby-deathmatch/arena.ts";
import { characterCameraZoom, followCameraX } from "../../src/game-engine/phaser-kit/camera.ts";
import { applyAttractor } from "../../src/games/lobby-deathmatch/hazards/attractor.ts";
import { touchesLava } from "../../src/games/lobby-deathmatch/hazards/lava.ts";
import lavaCavern from "../../src/games/lobby-deathmatch/maps/lava-cavern.ts";
import deepOcean from "../../src/games/lobby-deathmatch/maps/deep-ocean.ts";
import blackHole from "../../src/games/lobby-deathmatch/maps/black-hole.ts";
import { createKillCredit, KILL_CREDIT_MS } from "../../src/games/lobby-deathmatch/killCredit.ts";
import { deathmatchScoreboard } from "../../src/games/lobby-deathmatch/scoreboard.ts";
import { createDeathmatchItems, DEATHMATCH_ITEM_WINDOW_MS } from "../../src/games/lobby-deathmatch/items.ts";

const maps = [lavaCavern, deepOcean, blackHole];
for (const map of maps) {
  assert.equal(map.width, 960 * 3);
  assert.deepEqual(arenaCourse(map).platformsAt(0), map.platforms);
  assert.deepEqual(arenaCourse(map).platformsAt(1), []);
  for (const platform of map.platforms) {
    assert.ok(platform.y > map.ceilingY && platform.y < map.floorY);
    assert.ok(platform.x - platform.range >= 0 && platform.x + platform.width + platform.range <= map.width);
  }
  const spawnXs: number[] = [];
  for (let index = 0; index < map.spawns.length; index += 1) {
    const spawn = arenaSpawnPoint(map, (index + 0.1) / map.spawns.length, CLIMB_PLAYER_HEIGHT);
    const feet = spawn.y + CLIMB_PLAYER_HEIGHT / 2;
    spawnXs.push(spawn.x);
    assert.ok(map.platforms.some((platform) => platform.kind === "step" && Math.abs(platform.y - feet) <= 6
      && spawn.x > platform.x && spawn.x < platform.x + platform.width));
    for (const pusher of map.pushers) {
      const bodyTop = spawn.y - CLIMB_PLAYER_HEIGHT / 2;
      const besideIt = feet <= pusher.y || bodyTop >= pusher.y + pusher.height;
      const clearOfIt = pusher.wall === "left" ? spawn.x - 20 > pusher.reach : spawn.x + 20 < map.width - pusher.reach;
      assert.ok(besideIt || clearOfIt, "spawns never intersect a pusher's sweep");
    }
  }
  assert.ok(Math.min(...spawnXs) < map.width / 6 && Math.max(...spawnXs) > map.width * 5 / 6, "spawns span the expanded world");
}

const lava = lavaCavern.hazards.find((hazard) => hazard.kind === "lava")!;
assert.equal(touchesLava(lava, 100, -20), false);
assert.equal(touchesLava(lava, 2_700, 10), true, "lava uses world coordinates across the full map");
assert.equal(deepOcean.safeFloor, true);
assert.ok(deepOcean.gravityMultiplier < 1);
const hole = blackHole.hazards.find((hazard) => hazard.kind === "attractor")!;
const attracted = { center: { x: hole.x - 100, y: hole.y + 20 }, velocity: { x: 0, y: 0 } };
assert.equal(applyAttractor(hole, attracted, 16), false);
assert.ok(attracted.velocity.x > 0 && attracted.velocity.y < 0, "nearby players accelerate toward the centre");
const outside = { center: { x: hole.x - hole.radius - 1, y: hole.y }, velocity: { x: 0, y: 0 } };
applyAttractor(hole, outside, 16);
assert.deepEqual(outside.velocity, { x: 0, y: 0 });
assert.equal(applyAttractor(hole, { center: { x: hole.x, y: hole.y }, velocity: { x: 0, y: 0 } }, 16), true);

const zoom = characterCameraZoom(960, 620, 1_000, 660);
assert.equal(zoom, Math.min(960 / 1_000, 620 / 660), "expanding the world preserves the previous vertical scale");
assert.equal(followCameraX(500, 0, 1_000, ARENA_WIDTH, 16), 500);
assert.equal(followCameraX(2_380, ARENA_WIDTH, 1_000, ARENA_WIDTH, 16), 2_380);
const followed = followCameraX(500, 1_500, 1_000, ARENA_WIDTH, 32);
assert.ok(followed > 500 && followed < 1_500, "tracking is smooth, not a teleport");
assert.ok(Math.abs(followed - followCameraX(followCameraX(500, 1_500, 1_000, ARENA_WIDTH, 16), 1_500, 1_000, ARENA_WIDTH, 16)) < 1e-9);

// Pushers: rest in the wall, slide out slowly to their reach and back, without jumps between frames.
for (const pusher of ARENA_PUSHERS) {
  let previous = pusherExtension(pusher, 0);
  let max = 0, min = Infinity;
  for (let now = 16; now <= pusher.periodMs * 2; now += 16) {
    const extension = pusherExtension(pusher, now);
    assert.ok(Math.abs(extension - previous) < 6, "a pusher never snaps");
    max = Math.max(max, extension);
    min = Math.min(min, extension);
    previous = extension;
  }
  assert.equal(min, 0);
  assert.ok(Math.abs(max - pusher.reach) < 1);
  // It sweeps across a ledge just above its surface, at the height of someone standing there.
  const ledge = lavaCavern.platforms.find((platform) => platform.kind === "step" && platform.y - (pusher.y + pusher.height) >= 0
    && platform.y - (pusher.y + pusher.height) <= 8
    && (platform.x + platform.width / 2 < ARENA_WIDTH / 2) === (pusher.wall === "left"));
  assert.ok(ledge, "each pusher sweeps a ledge");
  const fullOut = pusherSpan(pusher, pusher.periodMs * 0.7 - pusher.offsetMs + pusher.periodMs, ARENA_WIDTH);
  if (pusher.wall === "left") assert.ok(fullOut.right > ledge.x + ledge.width, "pushes all the way off the ledge");
  else assert.ok(fullOut.left < ledge.x, "pushes all the way off the ledge");
}

// Kill credit: a recent punch earns the kill, a plain fall or an old punch does not, and a hit counts once.
const credit = createKillCredit();
assert.equal(credit.claim(1_000), null, "falling in on your own gives nobody a kill");
credit.hitBy("a", 1_000);
credit.hitBy("b", 2_000);
assert.equal(credit.claim(2_500), "b", "the latest puncher gets the kill");
assert.equal(credit.claim(2_600), null, "a hit is credited once");
credit.hitBy("a", 0);
assert.equal(credit.claim(KILL_CREDIT_MS + 1), null, "an old punch does not count");

// Scoreboard: kills first, then fewer deaths; players with only deaths still appear.
const record = (playerId: string, score: number) => ({ playerId, score, label: playerId, reachedAtMs: null });
assert.deepEqual(
  deathmatchScoreboard([record("a", 3), record("b", 3), record("c", 1)], [record("a", 4), record("b", 1), record("d", 2)])
    .map((row) => [row.playerId, row.kills, row.deaths]),
  [["b", 3, 1], ["a", 3, 4], ["c", 1, 0], ["d", 0, 2]],
);

// Each map shares deterministic item windows, restricted to its own static world platforms.
const seen = new Set<string>();
for (const map of maps) {
  const source = createDeathmatchItems(map);
  for (let window = 0; window < 100; window += 1) {
    const at = window * DEATHMATCH_ITEM_WINDOW_MS + 1;
    const items = source.itemsAt(at);
    assert.deepEqual(items, source.itemsAt(at + DEATHMATCH_ITEM_WINDOW_MS - 2));
    assert.equal(new Set(items.map((item) => item.id)).size, items.length);
    for (const item of items) {
      seen.add(item.kind);
      assert.equal(source.kindOf(item.id), item.kind);
      assert.ok(map.platforms.some((platform) => platform.kind === "step"
        && item.x > platform.x && item.x < platform.x + platform.width && item.y < platform.y));
    }
  }
  assert.equal(source.kindOf("nonsense"), null);
}
assert.deepEqual([...seen].sort(), ["attack", "dash", "jump", "punch", "speed", "sword"]);

console.log("lobby deathmatch tests passed");

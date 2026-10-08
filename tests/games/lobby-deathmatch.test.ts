import assert from "node:assert/strict";
import { CLIMB_PLAYER_HEIGHT } from "../../src/game-engine/jump-tower/course.ts";
import {
  ARENA_COURSE,
  ARENA_GADGET_COUNT,
  ARENA_LAVA_Y,
  ARENA_PLATFORMS,
  ARENA_PUSHERS,
  ARENA_WIDTH,
  arenaSpawnPoint,
  isInLava,
  pusherExtension,
  pusherSpan,
} from "../../src/games/lobby-deathmatch/arena.ts";
import { createKillCredit, KILL_CREDIT_MS } from "../../src/games/lobby-deathmatch/killCredit.ts";
import { deathmatchScoreboard } from "../../src/games/lobby-deathmatch/scoreboard.ts";
import { DEATHMATCH_ITEMS, DEATHMATCH_ITEM_WINDOW_MS } from "../../src/games/lobby-deathmatch/items.ts";

// Arena: few enough gadgets that falling in stays likely, all of them over the lava.
assert.ok(ARENA_GADGET_COUNT <= 10, "at most ten platforms and gadgets in total");
for (const platform of ARENA_PLATFORMS) {
  assert.ok(platform.y < ARENA_LAVA_Y, "every platform floats above the lava");
  assert.ok(platform.x - platform.range >= 0 && platform.x + platform.width + platform.range <= ARENA_WIDTH, "platforms stay on screen");
}
assert.deepEqual(ARENA_COURSE.platformsAt(0), ARENA_PLATFORMS);
assert.deepEqual(ARENA_COURSE.platformsAt(1), [], "the whole arena is one screen");

// Every standing platform can be reached with a double jump (about 197 px) from one below it, or from the spring.
const DOUBLE_JUMP_HEIGHT = 190;
const standing = ARENA_PLATFORMS.filter((platform) => platform.kind !== "pad");
for (const platform of standing) {
  const fromBelow = ARENA_PLATFORMS.some((other) => other !== platform && other.y > platform.y
    && (other.kind === "pad" || other.y - platform.y <= DOUBLE_JUMP_HEIGHT));
  assert.ok(fromBelow, `platform ${platform.index} is reachable`);
}

// Spawns land on a platform, never in the lava.
for (const roll of [0, 0.34, 0.67, 0.99]) {
  const spawn = arenaSpawnPoint(roll, CLIMB_PLAYER_HEIGHT);
  const feet = spawn.y + CLIMB_PLAYER_HEIGHT / 2;
  assert.ok(ARENA_PLATFORMS.some((platform) => platform.kind === "step" && Math.abs(platform.y - feet) <= 6
    && spawn.x > platform.x && spawn.x < platform.x + platform.width));
  assert.equal(isInLava(feet), false);
  for (const pusher of ARENA_PUSHERS) {
    const bodyTop = spawn.y - CLIMB_PLAYER_HEIGHT / 2;
    const besideIt = feet <= pusher.y || bodyTop >= pusher.y + pusher.height;
    const sweep = pusher.wall === "left" ? { left: 0, right: pusher.reach } : { left: ARENA_WIDTH - pusher.reach, right: ARENA_WIDTH };
    const clearOfIt = spawn.x + 20 < sweep.left || spawn.x - 20 > sweep.right;
    assert.ok(besideIt || clearOfIt, "nobody respawns in a pusher's path");
  }
}
assert.equal(isInLava(ARENA_LAVA_Y - 20), false);
assert.equal(isInLava(ARENA_LAVA_Y + 10), true);

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
  const ledge = ARENA_PLATFORMS.find((platform) => platform.kind === "step" && platform.y - (pusher.y + pusher.height) >= 0
    && platform.y - (pusher.y + pusher.height) <= 8
    && (platform.x + platform.width / 2 < ARENA_WIDTH / 2) === (pusher.wall === "left"));
  assert.ok(ledge, "each pusher sweeps a ledge");
  const fullOut = pusherSpan(pusher, pusher.periodMs * 0.7 - pusher.offsetMs + pusher.periodMs);
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

// Items: same for every client, never the star, all on static platforms, and every kind shows up.
const seen = new Set<string>();
for (let window = 0; window < 200; window += 1) {
  const at = window * DEATHMATCH_ITEM_WINDOW_MS + 1;
  const items = DEATHMATCH_ITEMS.itemsAt(at);
  assert.deepEqual(items, DEATHMATCH_ITEMS.itemsAt(at + DEATHMATCH_ITEM_WINDOW_MS - 2), "items stay put for their window");
  assert.equal(new Set(items.map((item) => item.id)).size, items.length);
  for (const item of items) {
    seen.add(item.kind);
    assert.equal(DEATHMATCH_ITEMS.kindOf(item.id), item.kind);
    assert.ok(ARENA_PLATFORMS.some((platform) => platform.kind === "step"
      && item.x > platform.x && item.x < platform.x + platform.width && item.y < platform.y));
  }
}
assert.equal(seen.has("star"), false, "no invincibility in the deathmatch");
assert.deepEqual([...seen].sort(), ["attack", "dash", "jump", "punch", "speed", "sword"]);
assert.equal(DEATHMATCH_ITEMS.kindOf("nonsense"), null);

console.log("lobby deathmatch tests passed");

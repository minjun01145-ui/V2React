import assert from "node:assert/strict";
import { captureChance, captureChancePercent, didCapture } from "../../src/games/pokemon-catch/captureRules.ts";
import { CAPTURE_REVEAL_DELAY_MS, CAPTURE_SHAKE_INTERVAL_MS, captureAnimationPlan } from "../../src/games/pokemon-catch/captureAnimation.ts";
import { encounterId, isFireRedWildEncounter } from "../../src/games/pokemon-catch/encounterRules.ts";
import { POKEMON_ITEMS, rewardItem } from "../../src/games/pokemon-catch/itemRules.ts";
import { POKEMON_ITEM } from "../../src/student-data/pokemon-catch/types.ts";
import { capturedPokemonDisplayName, capturedPokemonFromEncounter, normalizePokemonNickname } from "../../src/games/pokemon-catch/captureRecord.ts";
import { encounterLevel, pokemonTypeLabel } from "../../src/games/pokemon-catch/pokemonMetadata.ts";
assert.equal(encounterId("same-seed"), encounterId("same-seed"));
assert.equal(isFireRedWildEncounter(encounterId("range")), true);
assert.equal(isFireRedWildEncounter(1), false, "선물 포켓몬인 이상해씨는 야생 조우 목록에서 제외되어야 합니다.");
assert.equal(isFireRedWildEncounter(150), true, "교실 게임에서는 전설 포켓몬도 아주 낮은 확률로 출현해야 합니다.");
assert.equal(isFireRedWildEncounter(131), true, "낮은 확률의 야생 라프라스는 목록에 남아야 합니다.");
assert.ok(captureChance(255) > captureChance(3));
assert.ok(Math.abs(captureChance(255) - (85 / 255)) < .01);
assert.ok(Math.abs(captureChance(3) - (1 / 255)) < .001);
assert.ok(captureChance(45, { ballMultiplier: 1.5 }) > captureChance(45));
assert.ok(captureChance(45, { statusMultiplier: 2 }) > captureChance(45, { ballMultiplier: 1.5 }));
assert.equal(captureChancePercent(.004), 1);
assert.equal(captureChancePercent(.426), 43);
assert.equal(didCapture(.5, .49), true);
assert.equal(didCapture(.5, .5), false);
assert.deepEqual(captureAnimationPlan(.5, .49, 0), {
  captured: true,
  shakeCount: 3,
  durationMs: 3 * CAPTURE_SHAKE_INTERVAL_MS + CAPTURE_REVEAL_DELAY_MS,
});
assert.deepEqual(captureAnimationPlan(.5, .5, 0), {
  captured: false,
  shakeCount: 1,
  durationMs: CAPTURE_SHAKE_INTERVAL_MS + CAPTURE_REVEAL_DELAY_MS,
});
assert.equal(captureAnimationPlan(0, .9, .999).shakeCount, 3);
assert.equal(rewardItem(0), POKEMON_ITEM.POKE_BALL);
assert.equal(rewardItem(.349), POKEMON_ITEM.POKE_BALL);
assert.equal(rewardItem(.35), POKEMON_ITEM.SLEEP_SPRAY);
assert.equal(rewardItem(.70), POKEMON_ITEM.ANGER);
assert.equal(rewardItem(.90), POKEMON_ITEM.GREAT_BALL);
assert.deepEqual(POKEMON_ITEMS.map((item) => item.rewardWeight), [35, 35, 20, 10]);
assert.equal(pokemonTypeLabel("fire"), "불꽃");
assert.equal(encounterLevel("same", 25, 190), encounterLevel("same", 25, 190));
assert.ok(encounterLevel("legend", 150, 3) >= 50);
assert.equal(normalizePokemonNickname("  불꽃   왕자  "), "불꽃 왕자");
const captured = capturedPokemonFromEncounter({
  id: 4,
  name: "파이리",
  level: 12,
  types: ["불꽃"],
  description: "꼬리의 불꽃은 생명력의 상징이다.",
  heightMeters: .6,
  weightKg: 8.5,
  spriteUrl: "https://example.com/4.png",
  fallbackSpriteUrl: null,
  shinySpriteUrl: null,
  cryUrl: null,
  captureRate: 45,
}, "  숯돌이 ");
assert.equal(captured.nickname, "숯돌이");
assert.equal(capturedPokemonDisplayName(captured), "숯돌이");
assert.equal(captured.level, 12);

console.log("pokemon catch tests passed");

import assert from "node:assert/strict";
import { DEFAULT_MAX_HEALTH, HealthBook } from "../src/game-engine/combat/health.ts";
import { decodePunchDamage, encodePunchDamage, isHeavyHit, punchDamage } from "../src/game-engine/combat/punchDamage.ts";
import { SWORD_REACH } from "../src/game-engine/combat/sword.ts";
import { RECOIL_SHOVE_HOLD_MS, RECOIL_SHOVE_RISE_MS, recoilShove } from "../src/game-engine/phaser-kit/recoilShove.ts";
import {
  BUFF_DURATION_MS,
  activePartyBuffs,
  partyAttackBonus,
  permanentPartyItemCount,
  type PartyItemKind,
} from "../src/game-engine/platformer-party/buffs.ts";
import { FIST_REACH, choosePunchTarget, punchKnockback } from "../src/game-engine/platformer-party/punch.ts";

// Health: 200 to start, never below zero, back to full on reset.
const book = new HealthBook();
assert.equal(DEFAULT_MAX_HEALTH, 200);
assert.equal(book.get("a"), 200);
assert.equal(book.damage("a", 10), 190);
assert.equal(book.ratio("a"), 0.95);
assert.equal(book.damage("a", 500), 0, "health stops at zero");
book.reset("a");
assert.equal(book.get("a"), 200);

// Damage: 10 a punch, 20 boosted, +10% per attack pickup; 20 and up is a heavy hit.
assert.equal(punchDamage({ boosted: false, attackBonus: 0 }), 10);
assert.equal(punchDamage({ boosted: true, attackBonus: 0 }), 20);
assert.equal(punchDamage({ boosted: false, attackBonus: partyAttackBonus(1) }), 11);
assert.equal(punchDamage({ boosted: true, attackBonus: partyAttackBonus(3) }), 26);
assert.equal(isHeavyHit(10), false);
assert.equal(isHeavyHit(20), true);
for (const damage of [10, 11, 20, 26, 40]) {
  for (const direction of [-1, 1]) {
    const value = encodePunchDamage(direction, damage);
    assert.equal(decodePunchDamage(value), damage, "damage survives the punch event");
    assert.equal(Math.sign(value), direction);
    assert.ok(Math.abs(value) <= 10, "fits the live event value range");
  }
}
// The encoding keeps the old meaning of ±1 / ±2, so knockback is unchanged.
assert.equal(encodePunchDamage(1, 10), 1);
assert.equal(encodePunchDamage(-1, 20), -2);
assert.deepEqual(punchKnockback(encodePunchDamage(1, 20)), punchKnockback(2));

// Reach: the sword hits further and higher than a fist.
const swordOnly = { playerId: "far", x: 100, y: 40 };
assert.equal(choosePunchTarget({ x: 0, y: 0, facing: 1 }, [swordOnly]), null);
assert.equal(choosePunchTarget({ x: 0, y: 0, facing: 1 }, [swordOnly], SWORD_REACH)?.playerId, "far");
assert.ok(SWORD_REACH.forward > FIST_REACH.forward && SWORD_REACH.vertical > FIST_REACH.vertical);

// Items: attack-up is permanent and stacks (capped); timed buffs ignore it.
const kinds: Record<string, PartyItemKind> = { a1: "attack", a2: "attack", s1: "sword", p1: "punch" };
const claims = Object.keys(kinds).map((id, index) => ({ id, by: "me", atMs: index * 10 }));
const kindOf = (id: string) => kinds[id] ?? null;
const timed = activePartyBuffs(claims, "me", kindOf, 100);
assert.equal(timed.has("attack"), false, "attack never shows up as a timed buff");
assert.equal(timed.has("sword") && timed.has("punch"), true);
assert.equal(activePartyBuffs(claims, "me", kindOf, BUFF_DURATION_MS + 100).size, 0, "the sword wears off like other buffs");
assert.equal(permanentPartyItemCount(claims, "me", kindOf, "attack"), 2);
assert.equal(permanentPartyItemCount(claims, "other", kindOf, "attack"), 0);
assert.ok(Math.abs(partyAttackBonus(2) - 0.2) < 1e-9);
assert.equal(partyAttackBonus(1_000), partyAttackBonus(10), "attack bonus is capped");

// Regression: a remote hit is shown at once and must not swing back before the delayed
// real knockback arrives (that read as being knocked back twice).
assert.equal(recoilShove(-1), 0);
assert.ok(recoilShove(RECOIL_SHOVE_RISE_MS / 2) > 0.5, "the shove shows immediately");
for (let age = RECOIL_SHOVE_RISE_MS; age < RECOIL_SHOVE_RISE_MS + RECOIL_SHOVE_HOLD_MS; age += 10) {
  assert.equal(recoilShove(age), 1, "holds while the network catches up");
}
assert.ok(RECOIL_SHOVE_RISE_MS + RECOIL_SHOVE_HOLD_MS >= 350, "holds past the usual remote delay");
let previous = 1;
for (let age = RECOIL_SHOVE_RISE_MS + RECOIL_SHOVE_HOLD_MS; age < 2_000; age += 10) {
  const shove = recoilShove(age);
  assert.ok(shove <= previous, "only fades out afterwards");
  previous = shove;
}
assert.equal(previous, 0);

console.log("combat and party item tests passed");

import type Phaser from "phaser";
import type { Effects } from "../phaser-kit/Effects.ts";
import { DamageNumbers } from "./DamageNumbers.ts";
import { DEFAULT_MAX_HEALTH, HealthBook } from "./health.ts";
import { HealthBars } from "./HealthBars.ts";
import { SwordView } from "./SwordView.ts";

export interface Fighter {
  readonly id: string;
  /** Body centre on screen. */
  readonly x: number;
  readonly y: number;
  /** Where the health bar hangs (just above the name tag). */
  readonly barY: number;
  readonly facing: number;
  readonly holdsSword: boolean;
}

/**
 * Health, damage numbers and weapons for a Phaser fighting scene. The scene
 * decides who hit whom; this layer keeps everyone's health and draws it.
 */
export class CombatLayer {
  readonly health: HealthBook;
  private readonly bars: HealthBars;
  private readonly numbers: DamageNumbers;
  private readonly swords: SwordView;

  constructor(scene: Phaser.Scene, effects: Effects, maxHealth = DEFAULT_MAX_HEALTH) {
    this.health = new HealthBook(maxHealth);
    this.bars = new HealthBars(scene);
    this.numbers = new DamageNumbers(scene, effects);
    this.swords = new SwordView(scene);
  }

  /** Applies a hit, pops the number at (x, y) and returns the health left. */
  hit(targetId: string, damage: number, x: number, y: number): number {
    this.numbers.show(x, y, damage);
    return this.health.damage(targetId, damage);
  }

  /** The visible part of a swing: a sword wave for sword holders (fists animate on the actor). */
  swing(x: number, y: number, facing: number, sword: boolean): void {
    if (sword) this.swords.slash(x, y, facing);
  }

  reset(fighterId: string): void {
    this.health.reset(fighterId);
  }

  /** Call every frame with the fighters currently on screen. */
  draw(fighters: readonly Fighter[], time: number): void {
    this.bars.draw(fighters.map((fighter) => ({ x: fighter.x, y: fighter.barY, ratio: this.health.ratio(fighter.id) })));
    this.swords.drawHeld(fighters.filter((fighter) => fighter.holdsSword), time);
  }
}

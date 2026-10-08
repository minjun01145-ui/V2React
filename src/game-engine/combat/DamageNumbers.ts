import Phaser from "phaser";
import { FONT_FAMILY, TEXT_RESOLUTION } from "../phaser-kit/art.ts";
import type { Effects } from "../phaser-kit/Effects.ts";
import { isHeavyHit } from "./punchDamage.ts";

/** Damage popping off a hit fighter: "10" for a plain punch, a bigger "20!" for heavy hits. */
export class DamageNumbers {
  private readonly scene: Phaser.Scene;
  private readonly effects: Effects;

  constructor(scene: Phaser.Scene, effects: Effects) {
    this.scene = scene;
    this.effects = effects;
  }

  show(x: number, y: number, damage: number): void {
    const heavy = isHeavyHit(damage);
    this.effects.impactBurst(x, y, heavy);
    const label = this.scene.add.text(x + Phaser.Math.Between(-8, 8), y - 18, heavy ? `${damage}!` : String(damage), {
      fontFamily: FONT_FAMILY,
      fontSize: heavy ? "30px" : "20px",
      fontStyle: "700",
      color: heavy ? "#fde047" : "#ffffff",
      stroke: heavy ? "#b91c1c" : "#1e293b",
      strokeThickness: heavy ? 6 : 4,
    }).setOrigin(0.5).setDepth(35).setResolution(TEXT_RESOLUTION).setScale(heavy ? 0.4 : 0.6).setAngle(heavy ? Phaser.Math.Between(-12, 12) : 0);
    this.scene.tweens.add({ targets: label, scale: heavy ? 1.25 : 1, duration: heavy ? 160 : 120, ease: "Back.easeOut" });
    this.scene.tweens.add({ targets: label, y: label.y - (heavy ? 46 : 32), alpha: 0, delay: heavy ? 380 : 260, duration: 380,
      onComplete: () => label.destroy() });
    if (heavy) this.scene.cameras.main.shake(110, 0.006);
  }
}

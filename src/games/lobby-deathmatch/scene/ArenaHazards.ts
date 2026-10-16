import type Phaser from "phaser";
import { applyAttractor, type AttractedBody } from "../hazards/attractor.ts";
import { touchesLava } from "../hazards/lava.ts";
import type { ArenaHazard } from "../maps/types.ts";
import { AttractorView } from "./AttractorView.ts";
import { LavaView } from "./LavaView.ts";

export class ArenaHazards {
  private readonly hazards: readonly ArenaHazard[];
  private readonly views: readonly (LavaView | AttractorView)[];

  constructor(scene: Phaser.Scene, hazards: readonly ArenaHazard[]) {
    this.hazards = hazards;
    this.views = hazards.map((hazard) => hazard.kind === "lava" ? new LavaView(scene, hazard) : new AttractorView(scene, hazard));
  }

  update(time: number): void {
    for (const view of this.views) view.update(time);
  }

  apply(body: AttractedBody & { readonly bottom: number }, deltaMs: number): ArenaHazard | undefined {
    for (const hazard of this.hazards) {
      const fatal = hazard.kind === "lava"
        ? touchesLava(hazard, body.center.x, body.bottom)
        : applyAttractor(hazard, body, deltaMs);
      if (fatal) return hazard;
    }
    return undefined;
  }

  splash(x: number, feetY: number): void {
    for (let i = 0; i < this.hazards.length; i += 1) {
      const hazard = this.hazards[i]!;
      const view = this.views[i]!;
      if (hazard.kind === "lava" && view instanceof LavaView && touchesLava(hazard, x, feetY + 8)) view.splash(x);
    }
  }
}

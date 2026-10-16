export interface ClimbMapDefinition {
  readonly id: string;
  readonly name: string;
  readonly theme: {
    readonly sky: readonly [number, number];
    readonly wall: readonly [number, number];
    readonly ground: readonly [number, number];
    readonly platform: readonly [number, number];
    readonly moving: readonly [number, number];
    readonly milestone: readonly [number, number];
    readonly shape: "cloud" | "ice" | "rock";
    readonly scenery: "clouds" | "snow" | "embers";
    readonly accent: number;
  };
  readonly platforms: {
    readonly width: number;
    readonly minimumWidth: number;
    readonly milestoneWidth: number;
    readonly maxShift: number;
    readonly special: "moving" | "slippery" | "crumbling";
    readonly every: number;
    readonly offset: number;
    readonly movingRange: number;
    readonly movingPeriodMs: number;
  };
}

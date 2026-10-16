import { ARENA_PUSHERS, ARENA_WIDTH } from "../arena.ts";
import { arenaPlatforms, type ArenaMap } from "./types.ts";

const lavaCavern: ArenaMap = {
  id: "lava-cavern", name: "용암 동굴", width: ARENA_WIDTH, ceilingY: -580, floorY: 0,
  safeFloor: false, gravityMultiplier: 1,
  theme: { backdrop: "cave", background: 0x171324, ambient: 0x9a3412, ceiling: 0x292334, edge: 0xf97316, floor: 0x451a03, particles: "embers" },
  platforms: arenaPlatforms([
    [40, -170, 190], [395, -110, 170, "moving", 150, 4_600], [380, -270, 200],
    [100, -340, 160], [700, -340, 160], [410, -430, 140, "moving", 180, 6_200],
    [445, -36, 70, "pad"], [760, -160, 180], [1_025, -100, 180], [1_010, -280, 180],
    [1_260, -190, 170], [1_220, -420, 180], [1_510, -100, 180, "moving", 100, 5_200],
    [1_560, -320, 180], [1_780, -190, 180], [1_870, -430, 180], [2_025, -90, 70, "pad"],
    [2_070, -280, 190], [2_330, -150, 190], [2_380, -420, 170, "moving", 140, 5_600],
    [2_570, -280, 190], [2_650, -340, 160], [2_700, -100, 140],
  ], 0x806b80, 0x45394e),
  spawns: [
    { x: 180, feetY: -340 }, { x: 790, feetY: -340 }, { x: 1_100, feetY: -280 },
    { x: 1_650, feetY: -320 }, { x: 2_165, feetY: -280 }, { x: 2_665, feetY: -280 },
  ],
  pushers: ARENA_PUSHERS,
  hazards: [{ kind: "lava", left: 0, right: ARENA_WIDTH, y: 0, color: 0xef4423, glow: 0xffd43b }],
};

export default lavaCavern;

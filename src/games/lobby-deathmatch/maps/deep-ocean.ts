import { ARENA_WIDTH } from "../arena.ts";
import { arenaPlatforms, type ArenaMap } from "./types.ts";

const deepOcean: ArenaMap = {
  id: "deep-ocean", name: "심해", width: ARENA_WIDTH, ceilingY: -580, floorY: 0,
  safeFloor: true, gravityMultiplier: 0.78,
  theme: { backdrop: "ocean", background: 0x052c52, ambient: 0x087e9c, ceiling: 0x064d70, edge: 0x67e8f9, floor: 0x167b8b, particles: "bubbles" },
  platforms: arenaPlatforms([
    [60, -110, 190], [310, -240, 180], [100, -390, 180], [550, -100, 190],
    [590, -380, 160], [780, -250, 190, "moving", 80, 5_400], [1_020, -120, 190],
    [1_070, -400, 180], [1_270, -260, 190], [1_500, -100, 180],
    [1_530, -410, 170, "moving", 100, 6_000], [1_750, -270, 190],
    [1_970, -130, 200], [2_030, -420, 180], [2_220, -280, 190],
    [2_440, -100, 190], [2_480, -410, 170], [2_680, -250, 160],
  ], 0x64ddd1, 0x157e96),
  spawns: [
    { x: 155, feetY: -110 }, { x: 645, feetY: -100 }, { x: 1_115, feetY: -120 },
    { x: 1_590, feetY: -100 }, { x: 2_070, feetY: -130 }, { x: 2_535, feetY: -100 },
  ],
  pushers: [], hazards: [],
};

export default deepOcean;

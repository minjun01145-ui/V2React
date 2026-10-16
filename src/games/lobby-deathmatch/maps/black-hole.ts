import { ARENA_WIDTH } from "../arena.ts";
import { arenaPlatforms, type ArenaMap } from "./types.ts";

const blackHole: ArenaMap = {
  id: "black-hole", name: "블랙홀 우주", width: ARENA_WIDTH, ceilingY: -580, floorY: 0,
  safeFloor: true, gravityMultiplier: 1,
  theme: { backdrop: "stars", background: 0x080b25, ambient: 0x412476, ceiling: 0x242548, edge: 0xc4b5fd, floor: 0x373762, particles: "stardust" },
  platforms: arenaPlatforms([
    [50, -140, 200], [290, -290, 180], [100, -430, 180], [540, -150, 180],
    [590, -420, 170], [790, -290, 180], [1_030, -140, 190], [1_000, -440, 180],
    [1_235, -400, 140], [1_355, -80, 170], [1_515, -450, 150], [1_690, -140, 190],
    [1_790, -360, 180], [1_950, -230, 180, "moving", 80, 5_000], [2_100, -430, 170],
    [2_230, -120, 190], [2_430, -290, 180], [2_620, -430, 180], [2_660, -140, 180],
  ], 0xc0b5f5, 0x635b94),
  spawns: [
    { x: 150, feetY: -140 }, { x: 630, feetY: -150 }, { x: 1_125, feetY: -140 },
    { x: 1_785, feetY: -140 }, { x: 2_325, feetY: -120 }, { x: 2_750, feetY: -140 },
  ],
  pushers: [],
  hazards: [{ kind: "attractor", x: 1_440, y: -285, radius: 300, coreRadius: 37, acceleration: 160, color: 0xc084fc }],
};

export default blackHole;

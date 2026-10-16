import type { ClimbMapDefinition } from "./types.ts";

export default {
  id: "ice-cavern", name: "얼음 동굴",
  theme: {
    sky: [0x102b57, 0x326f99], wall: [0x144775, 0x4e9bc6], ground: [0xb9f1ff, 0x3b789e],
    platform: [0xb9f5ff, 0x438bb9], moving: [0x87e9ff, 0x2865a1], milestone: [0xe3faff, 0x6eb2d4],
    shape: "ice", scenery: "snow", accent: 0xc0f6ff,
  },
  platforms: { width: 205, minimumWidth: 150, milestoneWidth: 290, maxShift: 180,
    special: "slippery", every: 3, offset: 1, movingRange: 0, movingPeriodMs: 0 },
} as const satisfies ClimbMapDefinition;

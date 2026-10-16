import type { ClimbMapDefinition } from "./types.ts";

export default {
  id: "sky-islands", name: "하늘 섬",
  theme: {
    sky: [0x55b9f5, 0xdff7ff], wall: [0x81cba5, 0xb9edbd], ground: [0xb9ebaf, 0x719a66],
    platform: [0xffffff, 0xa5dcef], moving: [0xc7f9ff, 0x65bfdc], milestone: [0xfff4bc, 0xe4c66c],
    shape: "cloud", scenery: "clouds", accent: 0xffffff,
  },
  platforms: { width: 180, minimumWidth: 110, milestoneWidth: 270, maxShift: 205,
    special: "moving", every: 4, offset: 2, movingRange: 55, movingPeriodMs: 4000 },
} as const satisfies ClimbMapDefinition;

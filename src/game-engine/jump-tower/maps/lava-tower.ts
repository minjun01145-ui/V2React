import type { ClimbMapDefinition } from "./types.ts";

export default {
  id: "lava-tower", name: "용암 탑",
  theme: {
    sky: [0x280e1e, 0xa13427], wall: [0x38222c, 0x65404a], ground: [0x5b3740, 0x281b27],
    platform: [0x79515b, 0x3c2833], moving: [0xa55b45, 0x582f30], milestone: [0xffd17c, 0xb46b3f],
    shape: "rock", scenery: "embers", accent: 0xff863f,
  },
  platforms: { width: 185, minimumWidth: 120, milestoneWidth: 280, maxShift: 195,
    special: "crumbling", every: 3, offset: 1, movingRange: 0, movingPeriodMs: 0 },
} as const satisfies ClimbMapDefinition;

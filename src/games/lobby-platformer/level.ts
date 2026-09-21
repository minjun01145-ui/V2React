export const VIEW_WIDTH = 960;
export const VIEW_HEIGHT = 540;
export const WORLD_WIDTH = 3200;
export const WORLD_HEIGHT = 660;
export const SPAWN = { x: 110, y: 470 } as const;
export const PLAYER_WIDTH = 28;
export const PLAYER_HEIGHT = 48;
export const GRAVITY = 1450;
export const RUN_SPEED = 280;

/** Top-left coordinates, in pixels. Physics and scenery use the same geometry. */
export const PLATFORMS = [
  { x: 0, y: 500, width: 640, height: 160 },
  { x: 800, y: 500, width: 600, height: 160 },
  { x: 1580, y: 500, width: 580, height: 160 },
  { x: 2360, y: 500, width: 840, height: 160 },
  { x: 250, y: 405, width: 155, height: 24 },
  { x: 460, y: 310, width: 150, height: 24 },
  { x: 670, y: 375, width: 110, height: 24 },
  { x: 870, y: 285, width: 155, height: 24 },
  { x: 1110, y: 370, width: 140, height: 24 },
  { x: 1320, y: 245, width: 150, height: 24 },
  { x: 1490, y: 380, width: 110, height: 24 },
  { x: 1740, y: 395, width: 140, height: 24 },
  { x: 1950, y: 290, width: 140, height: 24 },
  { x: 2180, y: 365, width: 140, height: 24 },
  { x: 2440, y: 270, width: 160, height: 24 },
  { x: 2700, y: 375, width: 160, height: 24 },
] as const;

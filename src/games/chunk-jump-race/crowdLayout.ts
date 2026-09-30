/**
 * Placement for several runners landed on the same platform. Bodies fan out
 * across the platform (overlap is fine), while name tags go into a grid above
 * so every nickname stays readable. The local player always takes the first,
 * lowest slot so they can find themselves instantly.
 */

export interface CrowdSlot {
  /** Body offset from the platform centre. */
  readonly bodyX: number;
  /** Name tag position relative to the platform centre and the feet line. */
  readonly tagX: number;
  readonly tagY: number;
}

export const CROWD_TAG_COLUMN_WIDTH = 80;
export const CROWD_TAG_ROW_HEIGHT = 23;
export const CROWD_FIRST_TAG_Y = -58;
const MAX_BODY_SPREAD = 44;

export function crowdColumns(count: number): number {
  if (count <= 4) return 1;
  if (count <= 10) return 2;
  if (count <= 18) return 3;
  return 4;
}

/** Orders a crowd deterministically: self first, then by id so tags never shuffle between frames. */
export function orderCrowd(ids: readonly string[], selfId: string | undefined): string[] {
  return [...ids].sort((left, right) => {
    if (left === selfId) return -1;
    if (right === selfId) return 1;
    return left.localeCompare(right);
  });
}

/** The local player's tag is larger, so it gets a full-width row of its own. */
export const CROWD_SELF_ROW_HEIGHT = 27;

/**
 * Slots for `count` runners. When `selfFirst` is set, slot 0 belongs to the
 * local player (see orderCrowd) and everyone else stacks above that row.
 */
export function crowdSlots(count: number, selfFirst = false): CrowdSlot[] {
  if (count <= 1) return count === 1 ? [{ bodyX: 0, tagX: 0, tagY: CROWD_FIRST_TAG_Y }] : [];
  const spread = Math.min(MAX_BODY_SPREAD, (count - 1) * 9);
  const bodyX = (index: number): number => Math.round(-spread + (2 * spread * index) / (count - 1));
  const gridStart = selfFirst ? 1 : 0;
  const gridTop = selfFirst ? CROWD_FIRST_TAG_Y - CROWD_SELF_ROW_HEIGHT : CROWD_FIRST_TAG_Y;
  const columns = crowdColumns(count - gridStart);
  return Array.from({ length: count }, (_unused, index) => {
    if (index < gridStart) return { bodyX: bodyX(index), tagX: 0, tagY: CROWD_FIRST_TAG_Y };
    const gridIndex = index - gridStart;
    const column = gridIndex % columns;
    const row = Math.floor(gridIndex / columns);
    return {
      bodyX: bodyX(index),
      tagX: Math.round((column - (columns - 1) / 2) * CROWD_TAG_COLUMN_WIDTH),
      tagY: gridTop - row * CROWD_TAG_ROW_HEIGHT,
    };
  });
}

/** Emoji reactions students send to the teacher's slide screen. The index is what travels. */
export const SLIDE_REACTIONS = [
  { emoji: "❤️", label: "좋아요" },
  { emoji: "❓", label: "궁금해요" },
  { emoji: "❗", label: "놀라워요" },
  { emoji: "😄", label: "재밌어요" },
  { emoji: "😐", label: "그저 그래요" },
  { emoji: "😢", label: "슬퍼요" },
] as const;

/** Longer than the 0.8 s minimum interval the Realtime Database rules enforce, so network jitter never trips it. */
export const SLIDE_REACTION_COOLDOWN_MS = 1_200;

export interface SlideReaction {
  readonly playerId: string;
  readonly reaction: number;
  readonly sentAtMs: number;
}

export function isSlideReactionIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < SLIDE_REACTIONS.length;
}

/** Reads one stored reaction (`{ e, t }`), ignoring anything malformed. */
export function parseStoredReaction(playerId: string, value: unknown): SlideReaction | null {
  if (typeof value !== "object" || value === null) return null;
  const { e, t } = value as Record<string, unknown>;
  return isSlideReactionIndex(e) && typeof t === "number" && Number.isFinite(t) ? { playerId, reaction: e, sentAtMs: t } : null;
}

/**
 * Each student keeps one latest reaction. Given the previous and current snapshots, returns the
 * reactions that are new since the previous one; the first snapshot only sets the baseline.
 */
export function newReactions(previous: ReadonlyMap<string, number> | null, current: readonly SlideReaction[]): SlideReaction[] {
  if (!previous) return [];
  return current.filter((item) => item.sentAtMs > (previous.get(item.playerId) ?? -Infinity));
}

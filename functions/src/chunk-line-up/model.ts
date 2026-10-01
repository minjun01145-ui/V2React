import type {
  ChunkLineUpAssignment,
  ChunkLineUpBoard,
  ChunkLineUpGroup,
  ChunkLineUpSlot,
  ChunkLineUpSourceGroup,
} from "./types.js";

/**
 * Card rules.
 *
 * Every open slot is held by exactly one card, so nobody else can fill "your"
 * slot and every sentence can always be finished. Placing a card attaches the
 * player to that sentence until it is complete; then everyone who built it gets
 * a card for the replacement sentence. Players without a card (more players than
 * open slots) wait and are dealt in on the next completion.
 */

export const CHUNK_LINE_UP_MAX_GROUPS = 6;
const PLAYERS_PER_GROUP = 3;

export interface ChunkLineUpPlayerProfile {
  readonly playerId: string;
  readonly label: string;
}

export interface ChunkLineUpTarget {
  readonly groupId: string;
  readonly slotId: string;
  readonly text: string;
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function shuffled<T>(values: readonly T[], seed: string): T[] {
  return [...values].sort((left, right) => {
    const leftKey = hash(`${seed}:${JSON.stringify(left)}`);
    const rightKey = hash(`${seed}:${JSON.stringify(right)}`);
    return leftKey - rightKey;
  });
}

export function instantiateChunkLineUpGroup(
  source: ChunkLineUpSourceGroup,
  sequence: number,
  fixedSlotIds: ReadonlySet<string> = new Set(),
): ChunkLineUpGroup {
  const groupId = `lineup-${sequence}`;
  return {
    id: groupId,
    sourceId: source.id,
    prompt: source.prompt,
    slots: source.slots.map((text, index): ChunkLineUpSlot => {
      const id = `${groupId}:slot:${index}`;
      return { id, text, fixed: fixedSlotIds.has(id), filledBy: null, filledLabel: null };
    }),
  };
}

export function chunkLineUpGroupCount(sourceCount: number, playerCount: number): number {
  return Math.min(sourceCount, Math.max(1, Math.min(CHUNK_LINE_UP_MAX_GROUPS, Math.ceil(playerCount / PLAYERS_PER_GROUP))));
}

function carrying(assignment: ChunkLineUpAssignment): boolean {
  return assignment.token !== "" && assignment.attachedGroupId === null;
}

function withCard(assignment: ChunkLineUpAssignment, target: ChunkLineUpTarget | null): ChunkLineUpAssignment {
  return {
    ...assignment,
    token: target?.text ?? "",
    targetGroupId: target?.groupId ?? "",
    targetSlotId: target?.slotId ?? "",
    attachedGroupId: null,
  };
}

export function openChunkLineUpTargets(groups: readonly ChunkLineUpGroup[]): ChunkLineUpTarget[] {
  return groups.flatMap((group) => group.slots.flatMap((slot) =>
    !slot.fixed && !slot.filledBy ? [{ groupId: group.id, slotId: slot.id, text: slot.text }] : [],
  ));
}

/**
 * Restores the one-card-per-open-slot invariant: cards pointing at slots that
 * are no longer open are dropped, then card-less (waiting) players are dealt
 * the open slots nobody holds. Cards that are still valid are never changed.
 */
export function dealChunkLineUpCards(
  groups: readonly ChunkLineUpGroup[],
  assignments: Readonly<Record<string, ChunkLineUpAssignment>>,
  seed: string,
  priorityPlayerIds: readonly string[] = [],
): Record<string, ChunkLineUpAssignment> {
  const open = openChunkLineUpTargets(groups);
  const openIds = new Set(open.map((target) => target.slotId));
  const next: Record<string, ChunkLineUpAssignment> = {};
  const held = new Set<string>();
  for (const [playerId, assignment] of Object.entries(assignments)) {
    const valid = carrying(assignment) && openIds.has(assignment.targetSlotId) && !held.has(assignment.targetSlotId);
    if (valid) held.add(assignment.targetSlotId);
    next[playerId] = valid || assignment.attachedGroupId !== null ? assignment : withCard(assignment, null);
  }
  const unheld = shuffled(open.filter((target) => !held.has(target.slotId)), `${seed}:targets`);
  const waiting = Object.values(next).filter((assignment) => !carrying(assignment) && assignment.attachedGroupId === null);
  const priority = new Set(priorityPlayerIds);
  const ordered = [
    ...shuffled(waiting.filter((assignment) => priority.has(assignment.playerId)), `${seed}:priority`),
    ...shuffled(waiting.filter((assignment) => !priority.has(assignment.playerId)), `${seed}:waiting`),
  ];
  ordered.forEach((assignment, index) => {
    const target = unheld[index];
    if (target) next[assignment.playerId] = withCard(assignment, target);
  });
  return next;
}

export function buildInitialChunkLineUpBoard(
  sourceGroups: readonly ChunkLineUpSourceGroup[],
  players: readonly ChunkLineUpPlayerProfile[],
  seed: string,
): {
  readonly board: ChunkLineUpBoard;
  readonly orderedSourceGroups: readonly ChunkLineUpSourceGroup[];
  readonly nextSourceIndex: number;
  readonly nextGroupSequence: number;
} {
  if (players.length === 0) throw new Error("Chunk Line-Up requires at least one player.");
  if (sourceGroups.length === 0) throw new Error("Chunk Line-Up requires at least one source group.");
  const orderedSources = shuffled(sourceGroups, `${seed}:sources`);
  const groupCount = chunkLineUpGroupCount(orderedSources.length, players.length);
  const selected = orderedSources.slice(0, groupCount);
  const provisional = selected.map((source, index) => instantiateChunkLineUpGroup(source, index + 1));
  const totalSlots = provisional.reduce((sum, group) => sum + group.slots.length, 0);
  // Only overflow slots start fixed, so there is one open slot (one card) per player.
  // The first chunk of each sentence always stays open, so no sentence starts complete.
  const fixedCount = Math.max(0, totalSlots - players.length);
  const fixedCandidates = provisional.flatMap((group) => group.slots.slice(1).map((slot) => slot.id));
  const fixedIds = new Set(shuffled(fixedCandidates, `${seed}:fixed`).slice(0, fixedCount));
  const groups = selected.map((source, index) => instantiateChunkLineUpGroup(source, index + 1, fixedIds));

  const blank: Record<string, ChunkLineUpAssignment> = {};
  for (const player of players) {
    blank[player.playerId] = {
      playerId: player.playerId,
      label: player.label,
      token: "",
      targetGroupId: "",
      targetSlotId: "",
      attachedGroupId: null,
      score: 0,
      recentGroupId: null,
    };
  }
  return {
    board: { revision: 1, groups, assignments: dealChunkLineUpCards(groups, blank, seed), completedGroupCount: 0 },
    orderedSourceGroups: orderedSources,
    nextSourceIndex: groupCount,
    nextGroupSequence: groups.length + 1,
  };
}

export function isChunkLineUpElevatorDestinationOpen(
  board: ChunkLineUpBoard,
  floor: number,
  groupId: string,
): boolean {
  const group = board.groups[floor];
  return group?.id === groupId && group.slots.some((slot) => !slot.fixed && !slot.filledBy);
}

export function chunkLineUpGroupComplete(group: ChunkLineUpGroup): boolean {
  return group.slots.every((slot) => slot.fixed || Boolean(slot.filledBy));
}

export function chunkLineUpSlotAcceptsToken(slot: ChunkLineUpSlot, token: string): boolean {
  return token !== "" && !slot.fixed && !slot.filledBy && slot.text === token;
}

export function chooseChunkLineUpReplacementSource(
  sources: readonly ChunkLineUpSourceGroup[],
  startIndex: number,
  activeSourceIds: ReadonlySet<string>,
  completedSourceId: string,
): { readonly source: ChunkLineUpSourceGroup; readonly nextSourceIndex: number } | null {
  let completedFallback: { readonly source: ChunkLineUpSourceGroup; readonly nextSourceIndex: number } | null = null;
  for (let offset = 0; offset < sources.length; offset += 1) {
    const traversalIndex = startIndex + offset;
    const source = sources[traversalIndex % sources.length];
    if (!source || activeSourceIds.has(source.id)) continue;
    const candidate = { source, nextSourceIndex: traversalIndex + 1 };
    if (source.id !== completedSourceId) return candidate;
    completedFallback = candidate;
  }
  return completedFallback;
}

/** A replacement sentence with exactly `openCount` open slots (at least one, at most all). */
export function instantiateChunkLineUpReplacement(
  source: ChunkLineUpSourceGroup,
  sequence: number,
  openCount: number,
  seed: string,
): ChunkLineUpGroup {
  const open = Math.max(1, Math.min(source.slots.length, openCount));
  const provisional = instantiateChunkLineUpGroup(source, sequence);
  const fixedIds = new Set(shuffled(provisional.slots.map((slot) => slot.id), `${seed}:replacement-fixed`)
    .slice(0, source.slots.length - open));
  return instantiateChunkLineUpGroup(source, sequence, fixedIds);
}

export interface ChunkLineUpPlacementState {
  readonly board: ChunkLineUpBoard;
  readonly sourceGroups: readonly ChunkLineUpSourceGroup[];
  readonly nextSourceIndex: number;
  readonly nextGroupSequence: number;
}

export type ChunkLineUpPlacement =
  | { readonly kind: "wrong" | "stale" }
  | {
      readonly kind: "placed";
      readonly state: ChunkLineUpPlacementState;
      readonly score: number;
      readonly completedGroup: boolean;
    };

/** Applies one card placement; pure so the transaction in service.ts stays thin. */
export function placeChunkLineUpCard(
  current: ChunkLineUpPlacementState,
  playerId: string,
  groupId: string,
  slotId: string,
  seed: string,
): ChunkLineUpPlacement {
  const board = current.board;
  const assignment = board.assignments[playerId];
  if (!assignment || !carrying(assignment)) return { kind: "stale" };
  const groupIndex = board.groups.findIndex((group) => group.id === groupId);
  const group = board.groups[groupIndex];
  const slotIndex = group ? group.slots.findIndex((slot) => slot.id === slotId) : -1;
  const slot = group?.slots[slotIndex];
  if (!group || !slot || slot.fixed || slot.filledBy) return { kind: "stale" };
  if (!chunkLineUpSlotAcceptsToken(slot, assignment.token)) return { kind: "wrong" };

  const assignments: Record<string, ChunkLineUpAssignment> = {
    ...board.assignments,
    [playerId]: {
      ...withCard(assignment, null),
      attachedGroupId: group.id,
      score: assignment.score + 1,
      recentGroupId: group.id,
    },
  };
  const filledGroup: ChunkLineUpGroup = {
    ...group,
    slots: group.slots.map((item, index) => index === slotIndex ? { ...item, filledBy: playerId, filledLabel: assignment.label } : item),
  };
  let groups = board.groups.map((item, index) => index === groupIndex ? filledGroup : item);
  let nextState: Omit<ChunkLineUpPlacementState, "board"> = current;
  let completedGroup = false;
  let freed: string[] = [];

  if (chunkLineUpGroupComplete(filledGroup)) {
    completedGroup = true;
    freed = Object.values(assignments).filter((item) => item.attachedGroupId === group.id).map((item) => item.playerId);
    for (const id of freed) {
      const builder = assignments[id];
      if (builder) assignments[id] = { ...builder, attachedGroupId: null, score: builder.score + 1 };
    }
    const waitingCount = Object.values(assignments).filter((item) => !carrying(item) && item.attachedGroupId === null).length;
    const otherGroups = groups.filter((_item, index) => index !== groupIndex);
    const selection = chooseChunkLineUpReplacementSource(
      current.sourceGroups,
      current.nextSourceIndex,
      new Set(otherGroups.map((item) => item.sourceId)),
      group.sourceId,
    );
    if (!selection) return { kind: "stale" };
    const replacement = instantiateChunkLineUpReplacement(selection.source, current.nextGroupSequence, waitingCount, `${seed}:${current.nextGroupSequence}`);
    groups = groups.map((item, index) => index === groupIndex ? replacement : item);
    nextState = {
      sourceGroups: current.sourceGroups,
      nextSourceIndex: selection.nextSourceIndex,
      nextGroupSequence: current.nextGroupSequence + 1,
    };
  }

  // The builders of a finished sentence are dealt in first.
  const dealt = dealChunkLineUpCards(groups, assignments, `${seed}:${board.revision + 1}`, freed);
  return {
    kind: "placed",
    completedGroup,
    score: dealt[playerId]?.score ?? assignment.score + 1,
    state: {
      ...nextState,
      board: {
        revision: board.revision + 1,
        groups,
        assignments: dealt,
        completedGroupCount: board.completedGroupCount + (completedGroup ? 1 : 0),
      },
    },
  };
}

export function publicChunkLineUpBoard(board: ChunkLineUpBoard) {
  return {
    revision: board.revision,
    groups: board.groups.map((group) => ({
      ...group,
      slots: group.slots.map((slot) => ({
        ...slot,
        text: slot.fixed || slot.filledBy ? slot.text : "",
      })),
    })),
    assignments: Object.fromEntries(Object.entries(board.assignments).map(([playerId, assignment]) => [
      playerId,
      {
        playerId: assignment.playerId,
        label: assignment.label,
        token: assignment.token,
        attachedGroupId: assignment.attachedGroupId,
        score: assignment.score,
      },
    ])),
    completedGroupCount: board.completedGroupCount,
  };
}

import type {
  ChunkLineUpAssignment,
  ChunkLineUpBoard,
  ChunkLineUpGroup,
  ChunkLineUpSlot,
  ChunkLineUpSourceGroup,
} from "./types.js";

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
      const fixed = fixedSlotIds.has(id);
      return {
        id,
        text,
        fixed,
        filledBy: null,
        filledLabel: null,
      };
    }),
  };
}

function initialGroupSources(
  sources: readonly ChunkLineUpSourceGroup[],
  playerCount: number,
): { readonly sources: ChunkLineUpSourceGroup[]; readonly nextSourceIndex: number } {
  if (sources.length === 0) throw new Error("Chunk Line-Up requires at least one source group.");
  const groupCount = Math.min(sources.length, Math.max(1, Math.min(5, Math.ceil(playerCount / 4))));
  return { sources: sources.slice(0, groupCount), nextSourceIndex: groupCount };
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
  const orderedSources = shuffled(sourceGroups, `${seed}:sources`);
  const selected = initialGroupSources(orderedSources, players.length);
  const provisional = selected.sources.map((source, index) => instantiateChunkLineUpGroup(source, index + 1));
  const totalSlots = provisional.reduce((sum, group) => sum + group.slots.length, 0);
  const fixedCount = Math.max(0, totalSlots - players.length);
  const fixedCandidates = provisional.flatMap((group) => group.slots.slice(1).map((slot) => slot.id));
  const fixedIds = new Set(shuffled(fixedCandidates, `${seed}:fixed`).slice(0, fixedCount));
  const groups = selected.sources.map((source, index) => instantiateChunkLineUpGroup(source, index + 1, fixedIds));
  const targets = shuffled(openChunkLineUpTargets(groups), `${seed}:targets`);
  const orderedPlayers = shuffled(players, `${seed}:players`);
  if (targets.length === 0) throw new Error("Chunk Line-Up requires at least one playable target.");

  const assignments: Record<string, ChunkLineUpAssignment> = {};
  orderedPlayers.forEach((player, index) => {
    const target = targets[index % targets.length];
    if (!target) return;
    assignments[player.playerId] = {
      playerId: player.playerId,
      label: player.label,
      token: target.text,
      targetGroupId: target.groupId,
      targetSlotId: target.slotId,
      score: 0,
      recentGroupId: null,
    };
  });
  return {
    board: { revision: 1, groups, assignments, completedGroupCount: 0 },
    orderedSourceGroups: orderedSources,
    nextSourceIndex: selected.nextSourceIndex,
    nextGroupSequence: groups.length + 1,
  };
}

export function openChunkLineUpTargets(groups: readonly ChunkLineUpGroup[]): ChunkLineUpTarget[] {
  return groups.flatMap((group) => group.slots.flatMap((slot) =>
    !slot.fixed && !slot.filledBy
      ? [{ groupId: group.id, slotId: slot.id, text: slot.text }]
      : [],
  ));
}

export function chunkLineUpGroupComplete(group: ChunkLineUpGroup): boolean {
  return group.slots.every((slot) => slot.fixed || Boolean(slot.filledBy));
}

export function chunkLineUpSlotAcceptsToken(slot: ChunkLineUpSlot, token: string): boolean {
  return !slot.fixed && !slot.filledBy && slot.text === token;
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

export function instantiateChunkLineUpReplacement(
  source: ChunkLineUpSourceGroup,
  sequence: number,
  otherOpenSlotCount: number,
  playerCount: number,
): ChunkLineUpGroup {
  const desiredOpenCount = Math.max(1, Math.min(source.slots.length, playerCount - otherOpenSlotCount));
  const provisional = instantiateChunkLineUpGroup(source, sequence);
  const fixedIds = new Set(
    provisional.slots.slice(1, 1 + Math.max(0, source.slots.length - desiredOpenCount)).map((slot) => slot.id),
  );
  return instantiateChunkLineUpGroup(source, sequence, fixedIds);
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
        score: assignment.score,
      },
    ])),
    completedGroupCount: board.completedGroupCount,
  };
}

export function chooseChunkLineUpTarget(
  groups: readonly ChunkLineUpGroup[],
  assignments: Readonly<Record<string, ChunkLineUpAssignment>>,
  playerId: string,
  recentGroupId: string | null,
  seed: string,
): ChunkLineUpTarget | null {
  const targets = openChunkLineUpTargets(groups);
  if (targets.length === 0) return null;
  const counts = new Map<string, number>();
  for (const assignment of Object.values(assignments)) {
    if (assignment.playerId === playerId) continue;
    counts.set(assignment.targetSlotId, (counts.get(assignment.targetSlotId) ?? 0) + 1);
  }
  const preferred = recentGroupId ? targets.filter((target) => target.groupId !== recentGroupId) : targets;
  const pool = preferred.length > 0 ? preferred : targets;
  const minimum = Math.min(...pool.map((target) => counts.get(target.slotId) ?? 0));
  const leastUsed = pool.filter((target) => (counts.get(target.slotId) ?? 0) === minimum);
  return shuffled(leastUsed, seed)[0] ?? null;
}

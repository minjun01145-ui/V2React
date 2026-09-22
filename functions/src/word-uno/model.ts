import type {
  WordUnoActionResult,
  WordUnoAssignment,
  WordUnoCard,
  WordUnoFamily,
  WordUnoFamilyInput,
  WordUnoGroupState,
  WordUnoMemberProfile,
  WordUnoStage,
} from "./types.js";

export const WORD_UNO_HAND_SIZE = 7;
export const WORD_UNO_FAMILY_SLOTS = 30;
export const WORD_UNO_ROUND_MS = 180_000;
export const WORD_UNO_TURN_MS = 20_000;

export class WordUnoRuleError extends Error {}

export function shuffled<T>(values: readonly T[], random: () => number = Math.random): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = result[index];
    const swap = result[swapIndex];
    if (current !== undefined && swap !== undefined) {
      result[index] = swap;
      result[swapIndex] = current;
    }
  }
  return result;
}

export function wordUnoGroupSizes(count: number): number[] {
  if (count < 3) return [];
  if (count === 5) return [4];
  const groupCount = Math.floor(count / 3);
  const remainder = count % 3;
  const sizes = Array.from({ length: groupCount }, () => 3);
  for (let index = 0; index < remainder; index += 1) {
    const target = sizes.length - 1 - index;
    if (target >= 0) sizes[target] = 4;
  }
  return sizes;
}

export function groupWordUnoPlayers(
  playerIds: readonly string[],
  random: () => number = Math.random,
): { readonly groups: string[][]; readonly waitingPlayerIds: string[] } {
  const orderedPlayerIds = shuffled(playerIds, random);
  const groups: string[][] = [];
  let offset = 0;
  for (const size of wordUnoGroupSizes(orderedPlayerIds.length)) {
    groups.push(orderedPlayerIds.slice(offset, offset + size));
    offset += size;
  }
  return {
    groups,
    waitingPlayerIds: orderedPlayerIds.slice(offset),
  };
}

function cleaned(value: string): string {
  return value.trim();
}

export function dedupeExactFamilies(values: readonly WordUnoFamilyInput[]): WordUnoFamily[] {
  const seen = new Set<string>();
  const result: WordUnoFamily[] = [];
  for (const value of values) {
    const forms = [cleaned(value.sourceText), cleaned(value.form2), cleaned(value.form3)] as const;
    const meaning = cleaned(value.meaning);
    if (forms.some((item) => !item) || !meaning) continue;
    const key = JSON.stringify([...forms, meaning]);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      familyId: `family-${result.length + 1}`,
      forms,
      meaning,
    });
  }
  return result;
}

export function selectFamilySlots(
  families: readonly WordUnoFamily[],
  random: () => number = Math.random,
): WordUnoFamily[] {
  if (families.length === 0) return [];
  const selected = shuffled(families, random);
  if (selected.length >= WORD_UNO_FAMILY_SLOTS) return selected.slice(0, WORD_UNO_FAMILY_SLOTS);
  return Array.from({ length: WORD_UNO_FAMILY_SLOTS }, (_unused, index) => selected[index % selected.length]!);
}

export function buildWordUnoDeck(
  families: readonly WordUnoFamily[],
  random: () => number = Math.random,
): WordUnoCard[] {
  const slots = selectFamilySlots(families, random);
  const cards: WordUnoCard[] = [];
  slots.forEach((family, slotIndex) => {
    ([1, 2, 3] as const).forEach((stage) => {
      cards.push({
        id: `word:${slotIndex + 1}:${stage}`,
        kind: "word",
        text: family.forms[stage - 1]!,
        meaning: family.meaning,
        familyId: family.familyId,
        familyForms: family.forms,
        stage,
      });
    });
  });
  (["skip", "draw-two", "wild"] as const).forEach((kind) => {
    for (let index = 1; index <= 4; index += 1) cards.push({ id: `${kind}:${index}`, kind });
  });
  return shuffled(cards, random);
}

export function topCard(state: Pick<WordUnoGroupState, "discardPile">): WordUnoCard | null {
  return state.discardPile[state.discardPile.length - 1] ?? null;
}

export function isPlayableCard(
  card: WordUnoCard,
  activeStage: WordUnoStage,
  activeFamilyId: string,
): boolean {
  return card.kind !== "word" || card.stage === activeStage || card.familyId === activeFamilyId;
}

export function hasPlayableCard(
  hand: readonly WordUnoCard[],
  activeStage: WordUnoStage,
  activeFamilyId: string,
): boolean {
  return hand.some((card) => isPlayableCard(card, activeStage, activeFamilyId));
}

function cloneState(state: WordUnoGroupState): {
  groupId: string;
  groupLabel: string;
  memberIds: string[];
  memberProfiles: WordUnoMemberProfile[];
  status: "active" | "completed";
  generation: number;
  revision: number;
  hands: Record<string, WordUnoCard[]>;
  drawPile: WordUnoCard[];
  discardPile: WordUnoCard[];
  activeStage: WordUnoStage;
  activeFamilyId: string;
  currentPlayerId: string | null;
  turnDeadlineAtMs: number | null;
  endsAtMs: number;
  ranks: Record<string, number | null>;
} {
  return {
    ...state,
    memberIds: [...state.memberIds],
    memberProfiles: [...state.memberProfiles],
    hands: Object.fromEntries(state.memberIds.map((id) => [id, [...(state.hands[id] ?? [])]])),
    drawPile: [...state.drawPile],
    discardPile: [...state.discardPile],
    ranks: { ...state.ranks },
  };
}

function unrankedIds(state: Pick<WordUnoGroupState, "memberIds" | "ranks">): string[] {
  return state.memberIds.filter((id) => state.ranks[id] === null || state.ranks[id] === undefined);
}

export function nextUnfinishedPlayer(
  memberIds: readonly string[],
  ranks: Readonly<Record<string, number | null>>,
  afterPlayerId: string,
): string | null {
  if (memberIds.length === 0) return null;
  const start = memberIds.indexOf(afterPlayerId);
  for (let offset = 1; offset <= memberIds.length; offset += 1) {
    const candidate = memberIds[(Math.max(0, start) + offset) % memberIds.length];
    if (candidate && (ranks[candidate] === null || ranks[candidate] === undefined)) return candidate;
  }
  return null;
}

function drawCards(
  drawPile: readonly WordUnoCard[],
  discardPile: readonly WordUnoCard[],
  count: number,
  random: () => number,
): { readonly drawPile: WordUnoCard[]; readonly discardPile: WordUnoCard[]; readonly drawn: WordUnoCard[] } {
  let draw = [...drawPile];
  let discard = [...discardPile];
  const drawn: WordUnoCard[] = [];
  for (let index = 0; index < count; index += 1) {
    if (draw.length === 0 && discard.length > 1) {
      const top = discard[discard.length - 1]!;
      draw = shuffled(discard.slice(0, -1), random);
      discard = [top];
    }
    const card = draw.pop();
    if (!card) break;
    drawn.push(card);
  }
  return { drawPile: draw, discardPile: discard, drawn };
}

function markFinisher(state: ReturnType<typeof cloneState>, playerId: string): void {
  if ((state.hands[playerId]?.length ?? 0) !== 0 || state.ranks[playerId] !== null) return;
  const rankedCount = state.memberIds.filter((id) => state.ranks[id] !== null && state.ranks[id] !== undefined).length;
  state.ranks[playerId] = rankedCount + 1;
  const unfinished = unrankedIds(state);
  if (unfinished.length === 1) {
    state.ranks[unfinished[0]!] = state.memberIds.length;
    state.status = "completed";
    state.currentPlayerId = null;
    state.turnDeadlineAtMs = null;
  }
}

function assertTurn(state: WordUnoGroupState, playerId: string, now: number): void {
  if (state.status !== "active" || state.currentPlayerId !== playerId) {
    throw new WordUnoRuleError("현재 이 학생의 차례가 아닙니다.");
  }
  if (now >= state.endsAtMs) throw new WordUnoRuleError("게임 시간이 종료되었습니다.");
  if (state.turnDeadlineAtMs === null || now >= state.turnDeadlineAtMs) {
    throw new WordUnoRuleError("현재 턴의 시간이 끝났습니다.");
  }
}

function nextTurnDeadline(state: Pick<WordUnoGroupState, "endsAtMs">, now: number): number {
  return Math.min(state.endsAtMs, now + WORD_UNO_TURN_MS);
}

export function createWordUnoGroupState(input: {
  readonly groupId: string;
  readonly groupLabel: string;
  readonly memberIds: readonly string[];
  readonly memberProfiles: readonly WordUnoMemberProfile[];
  readonly families: readonly WordUnoFamily[];
  readonly endsAtMs: number;
  readonly now: number;
  readonly random?: () => number;
}): WordUnoGroupState {
  if (input.memberIds.length < 3 || input.memberIds.length > 4) throw new WordUnoRuleError("Word UNO 모둠은 3~4명이어야 합니다.");
  if (input.families.length === 0) throw new WordUnoRuleError("단어 변화형 항목이 없습니다.");
  const random = input.random ?? Math.random;
  const drawPile = buildWordUnoDeck(input.families, random);
  const hands: Record<string, WordUnoCard[]> = Object.fromEntries(input.memberIds.map((id) => [id, []]));
  for (let round = 0; round < WORD_UNO_HAND_SIZE; round += 1) {
    for (const memberId of input.memberIds) {
      const card = drawPile.pop();
      if (!card) throw new WordUnoRuleError("Word UNO 카드가 부족합니다.");
      hands[memberId]!.push(card);
    }
  }
  const normalIndex = drawPile.findIndex((card) => card.kind === "word");
  if (normalIndex < 0) throw new WordUnoRuleError("시작할 일반 카드를 찾지 못했습니다.");
  const initial = drawPile.splice(normalIndex, 1)[0];
  if (!initial || initial.kind !== "word") throw new WordUnoRuleError("시작할 일반 카드를 찾지 못했습니다.");
  return {
    groupId: input.groupId,
    groupLabel: input.groupLabel,
    memberIds: [...input.memberIds],
    memberProfiles: [...input.memberProfiles],
    status: "active",
    generation: 1,
    revision: 1,
    hands,
    drawPile,
    discardPile: [initial],
    activeStage: initial.stage,
    activeFamilyId: initial.familyId,
    currentPlayerId: input.memberIds[0] ?? null,
    turnDeadlineAtMs: Math.min(input.endsAtMs, input.now + WORD_UNO_TURN_MS),
    endsAtMs: input.endsAtMs,
    ranks: Object.fromEntries(input.memberIds.map((id) => [id, null])),
  };
}

export function playWordUnoCardState(
  state: WordUnoGroupState,
  playerId: string,
  cardId: string,
  wildStage: WordUnoStage | undefined,
  now: number,
  random: () => number = Math.random,
): { readonly state: WordUnoGroupState; readonly result: WordUnoActionResult } {
  assertTurn(state, playerId, now);
  const hand = state.hands[playerId] ?? [];
  const cardIndex = hand.findIndex((card) => card.id === cardId);
  if (cardIndex < 0) throw new WordUnoRuleError("내 손에 없는 카드입니다.");
  const card = hand[cardIndex]!;
  if (!isPlayableCard(card, state.activeStage, state.activeFamilyId)) {
    throw new WordUnoRuleError("지금 낼 수 없는 카드입니다.");
  }
  if (card.kind === "wild" && wildStage !== 1 && wildStage !== 2 && wildStage !== 3) {
    throw new WordUnoRuleError("WILD 카드는 다음 단계를 선택해야 합니다.");
  }

  const next = cloneState(state);
  const ownHand = next.hands[playerId]!;
  ownHand.splice(cardIndex, 1);
  next.discardPile.push(card);
  if (card.kind === "word") {
    next.activeStage = card.stage;
    next.activeFamilyId = card.familyId;
  } else if (card.kind === "wild") {
    next.activeStage = wildStage!;
  }

  const skippedPlayer = card.kind === "skip" || card.kind === "draw-two"
    ? nextUnfinishedPlayer(next.memberIds, next.ranks, playerId)
    : null;
  if (card.kind === "draw-two" && skippedPlayer) {
    const draw = drawCards(next.drawPile, next.discardPile, 2, random);
    next.drawPile = draw.drawPile;
    next.discardPile = draw.discardPile;
    next.hands[skippedPlayer]!.push(...draw.drawn);
  }

  markFinisher(next, playerId);
  if (next.status === "active") {
    const after = skippedPlayer ?? playerId;
    next.currentPlayerId = nextUnfinishedPlayer(next.memberIds, next.ranks, after);
    next.turnDeadlineAtMs = next.currentPlayerId ? nextTurnDeadline(next, now) : null;
  }
  next.revision += 1;
  const rank = next.ranks[playerId] ?? null;
  return {
    state: next,
    result: { accepted: true, revision: next.revision, completed: next.status === "completed", rank },
  };
}

function drawAndAdvance(
  state: WordUnoGroupState,
  playerId: string,
  now: number,
  random: () => number,
): { readonly state: WordUnoGroupState; readonly result: WordUnoActionResult } {
  const next = cloneState(state);
  const draw = drawCards(next.drawPile, next.discardPile, 1, random);
  next.drawPile = draw.drawPile;
  next.discardPile = draw.discardPile;
  next.hands[playerId]!.push(...draw.drawn);
  next.currentPlayerId = nextUnfinishedPlayer(next.memberIds, next.ranks, playerId);
  next.turnDeadlineAtMs = next.currentPlayerId ? nextTurnDeadline(next, now) : null;
  next.revision += 1;
  return {
    state: next,
    result: { accepted: true, revision: next.revision, completed: false, rank: next.ranks[playerId] ?? null },
  };
}

export function drawWordUnoCardState(
  state: WordUnoGroupState,
  playerId: string,
  now: number,
  random: () => number = Math.random,
): { readonly state: WordUnoGroupState; readonly result: WordUnoActionResult } {
  assertTurn(state, playerId, now);
  if (hasPlayableCard(state.hands[playerId] ?? [], state.activeStage, state.activeFamilyId)) {
    throw new WordUnoRuleError("낼 수 있는 카드가 있을 때는 카드를 뽑을 수 없습니다.");
  }
  return drawAndAdvance(state, playerId, now, random);
}

export function expireWordUnoTurnState(
  state: WordUnoGroupState,
  now: number,
  random: () => number = Math.random,
): { readonly state: WordUnoGroupState; readonly result: WordUnoActionResult } {
  if (state.status !== "active" || !state.currentPlayerId || state.turnDeadlineAtMs === null) {
    throw new WordUnoRuleError("진행 중인 턴이 없습니다.");
  }
  if (now >= state.endsAtMs) throw new WordUnoRuleError("게임 시간이 종료되었습니다.");
  if (now < state.turnDeadlineAtMs) throw new WordUnoRuleError("아직 턴 제한시간이 남아 있습니다.");
  return drawAndAdvance(state, state.currentPlayerId, now, random);
}

export function expireWordUnoGroupState(state: WordUnoGroupState): WordUnoGroupState {
  if (state.status === "completed") return state;
  const next = cloneState(state);
  const unfinished = unrankedIds(next);
  const alreadyRanked = next.memberIds.length - unfinished.length;
  const memberOrder = new Map(next.memberIds.map((id, index) => [id, index]));
  const sorted = [...unfinished].sort((left, right) =>
    (next.hands[left]?.length ?? 0) - (next.hands[right]?.length ?? 0)
    || (memberOrder.get(left) ?? 0) - (memberOrder.get(right) ?? 0),
  );
  let previousSize: number | null = null;
  let previousRank = alreadyRanked + 1;
  sorted.forEach((id, index) => {
    const size = next.hands[id]?.length ?? 0;
    const rank = previousSize !== null && size === previousSize
      ? previousRank
      : alreadyRanked + index + 1;
    next.ranks[id] = rank;
    previousSize = size;
    previousRank = rank;
  });
  next.status = "completed";
  next.currentPlayerId = null;
  next.turnDeadlineAtMs = null;
  next.revision += 1;
  return next;
}

export function assignmentForGroup(state: WordUnoGroupState, playerId: string): WordUnoAssignment {
  const profileById = new Map(state.memberProfiles.map((profile) => [profile.playerId, profile]));
  const ownRank = state.ranks[playerId] ?? null;
  const status = state.status === "completed" ? "completed" : ownRank === null ? "active" : "finished";
  const activeFamilyForms = [
    ...[...state.discardPile].reverse(),
    ...state.drawPile,
    ...state.memberIds.flatMap((id) => state.hands[id] ?? []),
  ]
    .find((card): card is Extract<WordUnoCard, { readonly kind: "word" }> => card.kind === "word" && card.familyId === state.activeFamilyId)
    ?.familyForms ?? null;
  return {
    playerId,
    groupId: state.groupId,
    groupLabel: state.groupLabel,
    status,
    generation: state.generation,
    revision: state.revision,
    hand: [...(state.hands[playerId] ?? [])],
    members: state.memberIds.map((id) => ({
      playerId: id,
      nickname: profileById.get(id)?.nickname || id,
      handCount: state.hands[id]?.length ?? 0,
      rank: state.ranks[id] ?? null,
    })),
    topCard: topCard(state),
    activeStage: state.activeStage,
    activeFamilyId: state.activeFamilyId,
    activeFamilyForms,
    currentPlayerId: state.currentPlayerId,
    turnDeadlineAtMs: state.turnDeadlineAtMs,
    endsAtMs: state.endsAtMs,
    rank: ownRank,
  };
}

export function waitingAssignment(playerId: string, endsAtMs: number): WordUnoAssignment {
  return {
    playerId,
    groupId: null,
    groupLabel: null,
    status: "waiting",
    generation: 0,
    revision: 0,
    hand: [],
    members: [],
    topCard: null,
    activeStage: null,
    activeFamilyId: null,
    activeFamilyForms: null,
    currentPlayerId: null,
    turnDeadlineAtMs: null,
    endsAtMs,
    rank: null,
  };
}

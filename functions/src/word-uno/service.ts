import { FieldValue, type DocumentReference, type Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { db } from "../shared/firebase.js";
import { belongsToTenant, effectiveTenantId, type TenantId } from "../shared/tenant.js";
import { tenantLearningSetsCollection } from "../shared/tenantData.js";
import { isRecord } from "../shared/validation.js";
import {
  assignmentForGroup,
  createWordUnoGroupState,
  dedupeExactFamilies,
  drawWordUnoCardState,
  expireWordUnoGroupState,
  expireWordUnoTurnState,
  playWordUnoCardState,
  waitingAssignment,
  WORD_UNO_ROUND_MS,
  WordUnoRuleError,
  wordUnoGroupSizes,
} from "./model.js";
import type {
  WordUnoActionResult,
  WordUnoBaseInput,
  WordUnoCard,
  WordUnoDrawInput,
  WordUnoExpireTurnInput,
  WordUnoFamily,
  WordUnoFamilyInput,
  WordUnoGroupState,
  WordUnoMemberProfile,
  WordUnoPlayInput,
  WordUnoStage,
} from "./types.js";

const GAME_ID = "word-uno";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function integer(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) ? value : 0;
}

function stage(value: unknown): WordUnoStage | null {
  return value === 1 || value === 2 || value === 3 ? value : null;
}

function card(value: unknown): WordUnoCard | null {
  if (!isRecord(value)) return null;
  const id = text(value.id);
  if (!id) return null;
  if (value.kind === "skip" || value.kind === "draw-two" || value.kind === "wild") {
    return { id, kind: value.kind };
  }
  if (value.kind !== "word") return null;
  const cardStage = stage(value.stage);
  const cardText = text(value.text);
  const meaning = text(value.meaning);
  const familyId = text(value.familyId);
  const familyForms = Array.isArray(value.familyForms)
    ? value.familyForms.map(text)
    : [];
  if (!cardStage || !cardText || !meaning || !familyId || familyForms.length !== 3 || familyForms.some((item) => !item)) return null;
  return {
    id,
    kind: "word",
    text: cardText,
    meaning,
    familyId,
    familyForms: [familyForms[0]!, familyForms[1]!, familyForms[2]!],
    stage: cardStage,
  };
}

function cards(value: unknown): WordUnoCard[] | null {
  if (!Array.isArray(value)) return null;
  const parsed = value.map(card);
  return parsed.every((item): item is WordUnoCard => item !== null) ? parsed : null;
}

function storedGroup(value: unknown): WordUnoGroupState | null {
  if (!isRecord(value) || !Array.isArray(value.memberIds) || !Array.isArray(value.memberProfiles) || !isRecord(value.hands) || !isRecord(value.ranks)) return null;
  const memberIds = value.memberIds.filter((item): item is string => typeof item === "string" && Boolean(item));
  if (memberIds.length < 3 || memberIds.length > 4 || memberIds.length !== value.memberIds.length) return null;
  const memberProfiles: WordUnoMemberProfile[] = value.memberProfiles.flatMap((raw) => {
    if (!isRecord(raw)) return [];
    const playerId = text(raw.playerId);
    const nickname = text(raw.nickname);
    return playerId && nickname ? [{ playerId, nickname }] : [];
  });
  if (memberProfiles.length !== memberIds.length) return null;
  const hands: Record<string, WordUnoCard[]> = {};
  const ranks: Record<string, number | null> = {};
  for (const id of memberIds) {
    const parsedHand = cards(value.hands[id]);
    if (!parsedHand) return null;
    hands[id] = parsedHand;
    const rank = value.ranks[id];
    ranks[id] = rank === null ? null : (typeof rank === "number" && Number.isInteger(rank) && rank >= 1 ? rank : null);
  }
  const drawPile = cards(value.drawPile);
  const discardPile = cards(value.discardPile);
  const activeStage = stage(value.activeStage);
  const activeFamilyId = text(value.activeFamilyId);
  const status = value.status === "active" || value.status === "completed" ? value.status : null;
  const groupId = text(value.groupId);
  const groupLabel = text(value.groupLabel);
  const endsAtMs = typeof value.endsAtMs === "number" && Number.isFinite(value.endsAtMs) ? value.endsAtMs : 0;
  if (!drawPile || !discardPile || discardPile.length < 1 || !activeStage || !activeFamilyId || !status || !groupId || !groupLabel || endsAtMs <= 0) return null;
  return {
    groupId,
    groupLabel,
    memberIds,
    memberProfiles,
    status,
    generation: Math.max(1, integer(value.generation)),
    revision: Math.max(1, integer(value.revision)),
    hands,
    drawPile,
    discardPile,
    activeStage,
    activeFamilyId,
    currentPlayerId: typeof value.currentPlayerId === "string" && value.currentPlayerId ? value.currentPlayerId : null,
    turnDeadlineAtMs: typeof value.turnDeadlineAtMs === "number" && Number.isFinite(value.turnDeadlineAtMs) ? value.turnDeadlineAtMs : null,
    endsAtMs,
    ranks,
  };
}

function familyInputs(value: unknown): WordUnoFamilyInput[] {
  if (!isRecord(value) || !Array.isArray(value.items)) return [];
  return value.items.flatMap((raw) => {
    if (!isRecord(raw)) return [];
    const sourceText = text(raw.sourceText);
    const form2 = text(raw.form2);
    const form3 = text(raw.form3);
    const meaning = text(raw.meaning);
    return sourceText && form2 && form3 && meaning ? [{ sourceText, form2, form3, meaning }] : [];
  });
}

interface ValidRound {
  readonly sessionRef: DocumentReference;
  readonly roundRef: DocumentReference;
  readonly setId: string;
  readonly tenantId: TenantId;
  readonly expectedPlayerIds: readonly string[];
  readonly endsAtMs: number;
  readonly setRef: DocumentReference;
}

async function validateRound(input: WordUnoBaseInput): Promise<ValidRound> {
  const sessionRef = db.collection("multiplayerSessions").doc(input.roomId);
  const session = await sessionRef.get();
  const data: unknown = session.exists ? session.data() : null;
  if (!isRecord(data) || data.status !== "playing" || data.roundId !== input.roundId || data.gameId !== GAME_ID) {
    throw new HttpsError("failed-precondition", "진행 중인 Word UNO 라운드가 아닙니다.");
  }
  const config = isRecord(data.gameConfig) ? data.gameConfig : {};
  const setId = text(config.setId);
  const startedAtMs = typeof data.startedAtMs === "number" && Number.isFinite(data.startedAtMs) ? data.startedAtMs : 0;
  const expectedPlayerIds = Array.isArray(data.expectedPlayerIds)
    ? [...new Set(data.expectedPlayerIds.filter((item): item is string => typeof item === "string" && Boolean(item)))]
    : [];
  if (!setId || startedAtMs <= 0 || expectedPlayerIds.length === 0) {
    throw new HttpsError("failed-precondition", "Word UNO 시작 정보를 찾을 수 없습니다.");
  }
  const tenantId = effectiveTenantId(data.tenantId);
  const setRef = tenantLearningSetsCollection(tenantId).doc(setId);
  const metadata = await setRef.get();
  const meta: unknown = metadata.exists ? metadata.data() : null;
  if (!isRecord(meta) || !belongsToTenant(meta.tenantId, tenantId) || meta.type !== "form-changes") {
    throw new HttpsError("failed-precondition", "Word UNO는 단어 변화형 세트만 사용할 수 있습니다.");
  }
  return {
    sessionRef,
    roundRef: sessionRef.collection("rounds").doc(input.roundId),
    setId,
    tenantId,
    expectedPlayerIds,
    endsAtMs: startedAtMs + WORD_UNO_ROUND_MS,
    setRef,
  };
}

function profile(playerId: string, value: unknown): WordUnoMemberProfile {
  const raw = isRecord(value) ? value : {};
  const nickname = text(raw.nickname) || text(raw.displayName) || playerId;
  return { playerId, nickname };
}

function wordUnoStateRef(roundRef: DocumentReference) {
  return roundRef.collection("wordUnoState").doc("main");
}

function wordUnoGroupRef(roundRef: DocumentReference, groupId: string) {
  return roundRef.collection("wordUnoGroups").doc(groupId);
}

function wordUnoAssignmentRef(roundRef: DocumentReference, playerId: string) {
  return roundRef.collection("wordUnoAssignments").doc(playerId);
}

function wordUnoOperationRef(roundRef: DocumentReference, playerId: string, operationId: string) {
  return roundRef.collection("wordUnoOperations").doc(playerId).collection("items").doc(operationId);
}

function persistGroup(tx: Transaction, roundRef: DocumentReference, state: WordUnoGroupState, now: number): void {
  tx.set(wordUnoGroupRef(roundRef, state.groupId), {
    ...state,
    updatedAt: FieldValue.serverTimestamp(),
    updatedAtMs: now,
  });
  for (const playerId of state.memberIds) {
    tx.set(wordUnoAssignmentRef(roundRef, playerId), assignmentForGroup(state, playerId));
  }
}

function actionResult(value: unknown): WordUnoActionResult | null {
  if (!isRecord(value) || value.accepted !== true || typeof value.revision !== "number" || !Number.isInteger(value.revision)) return null;
  const rank = value.rank === null ? null : (typeof value.rank === "number" && Number.isInteger(value.rank) ? value.rank : null);
  return { accepted: true, revision: value.revision, completed: value.completed === true, rank };
}

function ruleError(error: unknown): never {
  if (error instanceof WordUnoRuleError) throw new HttpsError("failed-precondition", error.message);
  throw error;
}

function assertGroupRevision(state: WordUnoGroupState, revision: number, endsAtMs: number): void {
  if (state.endsAtMs !== endsAtMs) throw new HttpsError("failed-precondition", "Word UNO 라운드 시간이 변경되었습니다.");
  if (state.revision !== revision) throw new HttpsError("failed-precondition", "Word UNO 상태가 이미 변경되었습니다.");
}

async function familiesForRound(round: ValidRound): Promise<readonly WordUnoFamily[]> {
  const content = await round.setRef.collection("content").doc("main").get();
  const families = dedupeExactFamilies(familyInputs(content.exists ? content.data() : null));
  if (families.length === 0) throw new HttpsError("failed-precondition", "단어 변화형 세트에 사용할 항목이 없습니다.");
  return families;
}

export async function ensureWordUnoRoundService(input: WordUnoBaseInput): Promise<void> {
  const round = await validateRound(input);
  const families = await familiesForRound(round);
  const participantDocs = await Promise.all(
    round.expectedPlayerIds.map((playerId) => round.roundRef.collection("participants").doc(playerId).get()),
  );
  const profiles = new Map(round.expectedPlayerIds.map((playerId, index) => [playerId, profile(playerId, participantDocs[index]?.data())]));
  const sizes = wordUnoGroupSizes(round.expectedPlayerIds.length);
  const prepared: WordUnoGroupState[] = [];
  let offset = 0;
  const now = Date.now();
  for (const [index, size] of sizes.entries()) {
    const memberIds = round.expectedPlayerIds.slice(offset, offset + size);
    offset += size;
    prepared.push(createWordUnoGroupState({
      groupId: `uno-${index + 1}`,
      groupLabel: `UNO ${index + 1}`,
      memberIds,
      memberProfiles: memberIds.map((id) => profiles.get(id) ?? profile(id, null)),
      families,
      endsAtMs: round.endsAtMs,
      now,
    }));
  }
  const waitingPlayerIds = round.expectedPlayerIds.slice(offset);

  await db.runTransaction(async (tx) => {
    const stateRef = wordUnoStateRef(round.roundRef);
    if ((await tx.get(stateRef)).exists) return;
    tx.set(stateRef, {
      gameId: GAME_ID,
      setId: round.setId,
      status: "active",
      expectedPlayerIds: round.expectedPlayerIds,
      groupIds: prepared.map((group) => group.groupId),
      waitingPlayerIds,
      endsAtMs: round.endsAtMs,
      initializedAt: FieldValue.serverTimestamp(),
      initializedAtMs: now,
    });
    for (const group of prepared) persistGroup(tx, round.roundRef, group, now);
    for (const playerId of waitingPlayerIds) {
      tx.set(wordUnoAssignmentRef(round.roundRef, playerId), waitingAssignment(playerId, round.endsAtMs));
    }
  });
}

async function activeGroupForPlayer(
  tx: Transaction,
  roundRef: DocumentReference,
  playerId: string,
): Promise<{ readonly groupRef: DocumentReference; readonly state: WordUnoGroupState }> {
  const assignment = await tx.get(wordUnoAssignmentRef(roundRef, playerId));
  const assignmentData: unknown = assignment.exists ? assignment.data() : null;
  if (!isRecord(assignmentData) || assignmentData.playerId !== playerId || typeof assignmentData.groupId !== "string" || !assignmentData.groupId) {
    throw new HttpsError("failed-precondition", "이 학생은 진행 중인 Word UNO 모둠에 없습니다.");
  }
  const groupRef = wordUnoGroupRef(roundRef, assignmentData.groupId);
  const group = storedGroup((await tx.get(groupRef)).data());
  if (!group || !group.memberIds.includes(playerId)) throw new HttpsError("failed-precondition", "Word UNO 모둠 상태를 찾을 수 없습니다.");
  return { groupRef, state: group };
}

export async function playWordUnoCardService(uid: string, input: WordUnoPlayInput): Promise<WordUnoActionResult> {
  const round = await validateRound(input);
  return db.runTransaction(async (tx) => {
    const operationRef = wordUnoOperationRef(round.roundRef, uid, input.operationId);
    const operation = await tx.get(operationRef);
    if (operation.exists) {
      const raw: unknown = operation.data();
      const stored = isRecord(raw) ? actionResult(raw.result) : null;
      if (isRecord(raw) && raw.action === "play" && raw.revision === input.revision && raw.cardId === input.cardId && (raw.wildStage ?? null) === (input.wildStage ?? null) && stored) return stored;
      throw new HttpsError("already-exists", "같은 작업 번호가 다른 Word UNO 작업에 사용되었습니다.");
    }
    const { state } = await activeGroupForPlayer(tx, round.roundRef, uid);
    assertGroupRevision(state, input.revision, round.endsAtMs);
    const now = Date.now();
    let transition;
    try {
      transition = playWordUnoCardState(state, uid, input.cardId, input.wildStage, now);
    } catch (error: unknown) {
      return ruleError(error);
    }
    persistGroup(tx, round.roundRef, transition.state, now);
    tx.create(operationRef, {
      action: "play",
      revision: input.revision,
      cardId: input.cardId,
      wildStage: input.wildStage ?? null,
      result: transition.result,
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: now,
    });
    return transition.result;
  });
}

export async function drawWordUnoCardService(uid: string, input: WordUnoDrawInput): Promise<WordUnoActionResult> {
  const round = await validateRound(input);
  return db.runTransaction(async (tx) => {
    const operationRef = wordUnoOperationRef(round.roundRef, uid, input.operationId);
    const operation = await tx.get(operationRef);
    if (operation.exists) {
      const raw: unknown = operation.data();
      const stored = isRecord(raw) ? actionResult(raw.result) : null;
      if (isRecord(raw) && raw.action === "draw" && raw.revision === input.revision && stored) return stored;
      throw new HttpsError("already-exists", "같은 작업 번호가 다른 Word UNO 작업에 사용되었습니다.");
    }
    const { state } = await activeGroupForPlayer(tx, round.roundRef, uid);
    assertGroupRevision(state, input.revision, round.endsAtMs);
    const now = Date.now();
    let transition;
    try {
      transition = drawWordUnoCardState(state, uid, now);
    } catch (error: unknown) {
      return ruleError(error);
    }
    persistGroup(tx, round.roundRef, transition.state, now);
    tx.create(operationRef, {
      action: "draw",
      revision: input.revision,
      result: transition.result,
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: now,
    });
    return transition.result;
  });
}

export async function expireWordUnoTurnService(uid: string, input: WordUnoExpireTurnInput): Promise<WordUnoActionResult> {
  const round = await validateRound(input);
  return db.runTransaction(async (tx) => {
    const { state } = await activeGroupForPlayer(tx, round.roundRef, uid);
    const ownRank = state.ranks[uid] ?? null;
    if (state.endsAtMs !== round.endsAtMs || state.revision !== input.revision || state.turnDeadlineAtMs !== input.deadlineAtMs || Date.now() < input.deadlineAtMs || Date.now() >= state.endsAtMs) {
      return { accepted: false, revision: state.revision, completed: state.status === "completed", rank: ownRank };
    }
    const now = Date.now();
    let transition;
    try {
      transition = expireWordUnoTurnState(state, now);
    } catch (error: unknown) {
      return ruleError(error);
    }
    persistGroup(tx, round.roundRef, transition.state, now);
    return transition.result;
  });
}

export async function expireWordUnoRoundService(input: WordUnoBaseInput): Promise<{ readonly accepted: boolean }> {
  const round = await validateRound(input);
  if (Date.now() < round.endsAtMs) return { accepted: false };
  return db.runTransaction(async (tx) => {
    const stateRef = wordUnoStateRef(round.roundRef);
    const state = await tx.get(stateRef);
    const stateData: unknown = state.exists ? state.data() : null;
    if (!isRecord(stateData)) throw new HttpsError("failed-precondition", "Word UNO가 아직 준비되지 않았습니다.");
    if (stateData.status === "completed") return { accepted: false };
    const groups = await tx.get(round.roundRef.collection("wordUnoGroups"));
    const now = Date.now();
    for (const groupDoc of groups.docs) {
      const group = storedGroup(groupDoc.data());
      if (!group || group.endsAtMs !== round.endsAtMs) throw new HttpsError("failed-precondition", "Word UNO 모둠 상태를 확인할 수 없습니다.");
      if (group.status === "completed") continue;
      persistGroup(tx, round.roundRef, expireWordUnoGroupState(group), now);
    }
    tx.update(stateRef, {
      status: "completed",
      completedAt: FieldValue.serverTimestamp(),
      completedAtMs: now,
    });
    return { accepted: true };
  });
}

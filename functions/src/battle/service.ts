import { FieldValue, type DocumentReference, type Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import {
  consumeStudentItemInTransaction,
  grantStudentItemInTransaction,
} from "../items/service.js";
import { db } from "../shared/firebase.js";
import { isRecord } from "../shared/validation.js";
import { evaluateBattleAnswer } from "./aiEvaluator.js";
import {
  BATTLE_INK_BLOCK_MS,
  battleInkTargetId,
  rollBattleReward,
  type BattleRewardItemId,
} from "./items.js";
import {
  BATTLE_MAX_TURNS,
  battleGroupSizes,
  displayName,
  nextBattleIndices,
  preferredBattlePairs,
  questionText,
  shuffled,
} from "./model.js";
import type {
  BattleExpireInput,
  BattleInput,
  BattleIssueInput,
  BattleItem,
  BattleProfile,
  BattleSubmitInput,
  BattleUseItemInput,
  StoredBattleMatch,
} from "./types.js";

const GAME_ID = "one-on-one-battle";
const HEARTS = 2;
const CHOOSE_MS = 10_000;
const ANSWER_MS = 20_000;
const RESULT_MS = 4_500;
const SAME_OPPONENT_FALLBACK_MS = 12_000;

interface BattleStats {
  readonly kills: number;
  readonly deaths: number;
  readonly lastOpponentId: string | null;
}

function integer(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) ? value : 0;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function profile(playerId: string, value: unknown): BattleProfile {
  const raw = isRecord(value) ? value : {};
  return {
    playerId,
    nickname: displayName(raw.nickname, raw.displayName),
    avatar: isRecord(raw.avatar) ? raw.avatar : null,
  };
}

function items(value: unknown): BattleItem[] {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new HttpsError("failed-precondition", "학습 세트 문항을 찾을 수 없습니다.");
  }
  return value.items.flatMap((raw, index) => {
    if (!isRecord(raw)) return [];
    const source = text(raw.sourceText).replaceAll("/", " ").replace(/\s+/g, " ");
    const meaning = text(raw.meaning);
    return source && meaning
      ? [{ id: text(raw.id) || `item-${index + 1}`, source, meaning }]
      : [];
  });
}

function storedMatch(value: unknown): StoredBattleMatch | null {
  if (
    !isRecord(value)
    || !Array.isArray(value.memberIds)
    || !Array.isArray(value.memberProfiles)
    || !isRecord(value.hearts)
  ) {
    return null;
  }

  const memberIds = value.memberIds.filter((item): item is string => typeof item === "string");
  const phase = value.phase === "choosing" || value.phase === "answering" || value.phase === "grading"
    ? value.phase
    : null;
  const selectedSide = value.selectedSide === "source" || value.selectedSide === "meaning"
    ? value.selectedSide
    : null;
  if (memberIds.length < 2 || !phase) return null;

  const rawHearts = value.hearts;
  const rawInk = isRecord(value.inkBlockedUntilAtMs) ? value.inkBlockedUntilAtMs : {};
  const rewardItemId = value.rewardItemId === "ink" ? "ink" : null;

  return {
    memberIds,
    memberProfiles: value.memberProfiles as BattleProfile[],
    hearts: Object.fromEntries(
      memberIds.map((id) => [id, Math.max(0, integer(rawHearts[id]))]),
    ),
    usedItemIds: Array.isArray(value.usedItemIds)
      ? value.usedItemIds.filter((item): item is string => typeof item === "string")
      : [],
    itemCount: integer(value.itemCount),
    questionNumber: integer(value.questionNumber),
    attackerIndex: integer(value.attackerIndex),
    defenderIndex: integer(value.defenderIndex),
    generation: integer(value.generation),
    phase,
    deadlineAtMs: typeof value.deadlineAtMs === "number" ? value.deadlineAtMs : null,
    selectedItemId: text(value.selectedItemId) || null,
    selectedSide,
    prompt: text(value.prompt) || null,
    expectedAnswer: text(value.expectedAnswer) || null,
    gradingSubmissionId: text(value.gradingSubmissionId) || null,
    eventRevision: integer(value.eventRevision),
    rewardItemId,
    inkBlockedUntilAtMs: Object.fromEntries(
      memberIds.map((id) => [
        id,
        typeof rawInk[id] === "number" && Number.isFinite(rawInk[id]) ? rawInk[id] : 0,
      ]),
    ),
  };
}

async function validateRound(input: BattleInput) {
  const sessionRef = db.collection("multiplayerSessions").doc(input.roomId);
  const session = await sessionRef.get();
  const data: unknown = session.data();
  if (
    !isRecord(data)
    || data.status !== "playing"
    || data.roundId !== input.roundId
    || data.gameId !== GAME_ID
  ) {
    throw new HttpsError("failed-precondition", "진행 중인 1:1 배틀 라운드가 아닙니다.");
  }

  const setId = isRecord(data.gameConfig) ? text(data.gameConfig.setId) : "";
  if (!setId) throw new HttpsError("failed-precondition", "선택된 학습 세트가 없습니다.");
  return { sessionRef, setId, sessionData: data };
}

function assertTime(data: Record<string, unknown>) {
  const config = isRecord(data.gameConfig) ? data.gameConfig : {};
  const mode = text(config.timedGameMode) || "3-minutes";
  const duration = mode === "unlimited" ? null : mode === "5-minutes" ? 300_000 : 180_000;
  const start = typeof data.startedAtMs === "number" ? data.startedAtMs : null;
  if (duration !== null && start !== null && Date.now() >= start + duration) {
    throw new HttpsError("failed-precondition", "게임 시간이 종료되었습니다.");
  }
}

function assignment(input: {
  readonly playerId: string;
  readonly matchId: string;
  readonly match: StoredBattleMatch;
  readonly stats: BattleStats;
  readonly now: number;
  readonly eventType?: string | null;
  readonly eventActorId?: string | null;
  readonly eventRewardItemId?: BattleRewardItemId | null;
}) {
  const attackerId = input.match.memberIds[input.match.attackerIndex];
  const defenderId = input.match.memberIds[input.match.defenderIndex];
  const blockedUntil = input.match.inkBlockedUntilAtMs[input.playerId] ?? 0;
  return {
    playerId: input.playerId,
    matchId: input.matchId,
    status: "active",
    phase: input.match.phase,
    role: input.playerId === attackerId
      ? "attacker"
      : input.playerId === defenderId
        ? "defender"
        : "waiting",
    hearts: input.match.hearts[input.playerId] ?? HEARTS,
    kills: input.stats.kills,
    deaths: input.stats.deaths,
    itemCount: input.match.itemCount,
    questionNumber: input.match.questionNumber,
    turnLimit: BATTLE_MAX_TURNS,
    usedItemIds: input.match.usedItemIds,
    generation: input.match.generation,
    deadlineAtMs: input.match.deadlineAtMs,
    prompt: input.match.prompt,
    selectedItemId: input.match.selectedItemId,
    selectedSide: input.match.selectedSide,
    eventRevision: input.match.eventRevision,
    eventType: input.eventType ?? null,
    eventWasMine: Boolean(input.eventActorId) && input.playerId === input.eventActorId,
    eventRewardItemId: input.eventRewardItemId ?? null,
    rewardAvailable: input.match.rewardItemId !== null,
    inkBlockedUntilAtMs: blockedUntil > input.now ? blockedUntil : null,
    searchStartedAtMs: null,
    resultUntilAtMs: null,
    result: null,
    updatedAt: FieldValue.serverTimestamp(),
    updatedAtMs: input.now,
  };
}

function searchingAssignment(input: {
  readonly playerId: string;
  readonly hearts: number;
  readonly stats: { readonly kills: number; readonly deaths: number };
  readonly itemCount: number;
  readonly questionNumber: number;
  readonly generation: number;
  readonly eventRevision: number;
  readonly eventType: string | null;
  readonly eventRewardItemId?: BattleRewardItemId | null;
  readonly now: number;
  readonly resultUntilAtMs: number | null;
  readonly result: unknown;
}) {
  return {
    playerId: input.playerId,
    matchId: null,
    status: "searching",
    phase: null,
    role: "waiting",
    hearts: input.hearts,
    kills: input.stats.kills,
    deaths: input.stats.deaths,
    itemCount: input.itemCount,
    questionNumber: input.questionNumber,
    turnLimit: BATTLE_MAX_TURNS,
    usedItemIds: [],
    generation: input.generation,
    deadlineAtMs: null,
    prompt: null,
    selectedItemId: null,
    selectedSide: null,
    eventRevision: input.eventRevision,
    eventType: input.eventType,
    eventWasMine: false,
    eventRewardItemId: input.eventRewardItemId ?? null,
    rewardAvailable: false,
    inkBlockedUntilAtMs: null,
    searchStartedAtMs: input.now,
    resultUntilAtMs: input.resultUntilAtMs,
    result: input.result,
    updatedAt: FieldValue.serverTimestamp(),
    updatedAtMs: input.now,
  };
}

async function statValues(
  tx: Transaction,
  roundRef: DocumentReference,
  ids: readonly string[],
): Promise<Map<string, BattleStats>> {
  const docs = await Promise.all(
    ids.map((id) => tx.get(roundRef.collection("battleStats").doc(id))),
  );
  return new Map(docs.map((doc) => [
    doc.id,
    {
      kills: integer(doc.data()?.kills),
      deaths: integer(doc.data()?.deaths),
      lastOpponentId: text(doc.data()?.lastOpponentId) || null,
    },
  ]));
}

async function writeActiveAssignments(
  tx: Transaction,
  roundRef: DocumentReference,
  matchId: string,
  match: StoredBattleMatch,
  now: number,
  eventType: string | null = null,
  knownStats?: Map<string, BattleStats>,
  eventActorId: string | null = null,
  eventRewardItemId: BattleRewardItemId | null = null,
) {
  const stats = knownStats ?? await statValues(tx, roundRef, match.memberIds);
  for (const id of match.memberIds) {
    tx.set(
      roundRef.collection("battleAssignments").doc(id),
      assignment({
        playerId: id,
        matchId,
        match,
        stats: stats.get(id) ?? { kills: 0, deaths: 0, lastOpponentId: null },
        now,
        eventType,
        eventActorId,
        eventRewardItemId,
      }),
    );
  }
}

function publicProfile(profileValue: BattleProfile) {
  return { nickname: profileValue.nickname, avatar: profileValue.avatar };
}

function newMatch(
  memberIds: readonly string[],
  profiles: Map<string, BattleProfile>,
  itemCount: number,
  generation: number,
  now: number,
): StoredBattleMatch {
  return {
    memberIds,
    memberProfiles: memberIds.map((id) => profiles.get(id) ?? profile(id, null)),
    hearts: Object.fromEntries(memberIds.map((id) => [id, HEARTS])),
    usedItemIds: [],
    itemCount,
    questionNumber: 0,
    attackerIndex: 0,
    defenderIndex: 1,
    generation,
    phase: "choosing",
    deadlineAtMs: now + CHOOSE_MS,
    selectedItemId: null,
    selectedSide: null,
    prompt: null,
    expectedAnswer: null,
    gradingSubmissionId: null,
    eventRevision: 0,
    rewardItemId: null,
    inkBlockedUntilAtMs: Object.fromEntries(memberIds.map((id) => [id, 0])),
  };
}

function opponentId(match: StoredBattleMatch, playerId: string): string | null {
  return match.memberIds.find((id) => id !== playerId) ?? null;
}

export async function ensureRound(input: BattleInput): Promise<void> {
  const { sessionRef, setId } = await validateRound(input);
  const metadata = await db.collection("learningSets").doc(setId).get();
  const content = await db.collection("learningSets").doc(setId).collection("content").doc("main").get();
  const meta: unknown = metadata.data();

  if (!isRecord(meta) || (meta.type !== "vocabulary" && meta.type !== "reading-chunks")) {
    throw new HttpsError("failed-precondition", "1:1 배틀은 단어 또는 끊어읽기 세트가 필요합니다.");
  }

  const itemCount = items(content.data()).length;
  if (!itemCount) throw new HttpsError("failed-precondition", "세트에 문항이 없습니다.");

  const roundRef = sessionRef.collection("rounds").doc(input.roundId);
  await db.runTransaction(async (tx) => {
    const stateRef = roundRef.collection("battleState").doc("main");
    if ((await tx.get(stateRef)).exists) return;

    const participants = await tx.get(roundRef.collection("participants"));
    const ids = shuffled(participants.docs.map((doc) => doc.id));
    const playerDocs = await Promise.all(
      ids.map((id) => tx.get(sessionRef.collection("players").doc(id))),
    );
    const profiles = new Map(
      ids.map((id, index) => [id, profile(id, playerDocs[index]?.data())]),
    );

    for (const id of ids) {
      const p = profiles.get(id) ?? profile(id, null);
      tx.set(roundRef.collection("battleStats").doc(id), {
        ...p,
        kills: 0,
        deaths: 0,
        status: "active",
        lastOpponentId: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    let offset = 0;
    for (const size of battleGroupSizes(ids.length)) {
      const memberIds = ids.slice(offset, offset + size);
      offset += size;
      const now = Date.now();

      if (memberIds.length < 2) {
        const id = memberIds[0];
        if (id) {
          tx.set(
            roundRef.collection("battleAssignments").doc(id),
            searchingAssignment({
              playerId: id,
              hearts: HEARTS,
              stats: { kills: 0, deaths: 0 },
              itemCount,
              questionNumber: 0,
              generation: 0,
              eventRevision: 0,
              eventType: null,
              now,
              resultUntilAtMs: null,
              result: null,
            }),
          );
          tx.update(roundRef.collection("battleStats").doc(id), { status: "searching" });
        }
        continue;
      }

      const matchId = `battle-${crypto.randomUUID()}`;
      const match = newMatch(memberIds, profiles, itemCount, 1, now);
      tx.set(roundRef.collection("battleMatches").doc(matchId), {
        ...match,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedAtMs: now,
      });
      for (const id of memberIds) {
        tx.set(
          roundRef.collection("battleAssignments").doc(id),
          assignment({
            playerId: id,
            matchId,
            match,
            stats: { kills: 0, deaths: 0, lastOpponentId: null },
            now,
          }),
        );
      }
    }

    tx.set(stateRef, {
      gameId: GAME_ID,
      itemCount,
      initializedAt: FieldValue.serverTimestamp(),
      initializedAtMs: Date.now(),
    });
  });
}

export async function refreshMatch(input: BattleInput): Promise<void> {
  const { sessionRef } = await validateRound(input);
  const roundRef = sessionRef.collection("rounds").doc(input.roundId);

  await db.runTransaction(async (tx) => {
    const state = await tx.get(roundRef.collection("battleState").doc("main"));
    if (!state.exists) return;
    const itemCount = integer(state.data()?.itemCount);
    const now = Date.now();

    const waiting = shuffled(
      (await tx.get(
        roundRef.collection("battleAssignments").where("status", "==", "searching"),
      )).docs,
    );
    const ready = waiting.filter((doc) => {
      const startedAt = typeof doc.data().searchStartedAtMs === "number"
        ? doc.data().searchStartedAtMs
        : now;
      return now - startedAt >= RESULT_MS;
    });
    if (ready.length < 2) return;

    const readyIds = ready.map((doc) => doc.id);
    const playerDocs = await Promise.all(
      readyIds.map((id) => tx.get(sessionRef.collection("players").doc(id))),
    );
    const profiles = new Map(
      readyIds.map((id, index) => [id, profile(id, playerDocs[index]?.data())]),
    );
    const readyStats = await statValues(tx, roundRef, readyIds);
    const assignmentsById = new Map(ready.map((doc) => [doc.id, doc]));

    const pairing = preferredBattlePairs(ready.map((doc) => {
      const searchStartedAtMs = typeof doc.data().searchStartedAtMs === "number"
        ? doc.data().searchStartedAtMs
        : now;
      return {
        id: doc.id,
        lastOpponentId: readyStats.get(doc.id)?.lastOpponentId ?? null,
        allowRepeat: now - searchStartedAtMs >= SAME_OPPONENT_FALLBACK_MS,
      };
    }));

    for (const pair of pairing.pairs) {
      const memberIds = [...pair];
      const firstAssignment = assignmentsById.get(memberIds[0] ?? "");
      const secondAssignment = assignmentsById.get(memberIds[1] ?? "");
      if (!firstAssignment || !secondAssignment) continue;

      const generation = Math.max(
        integer(firstAssignment.data().generation),
        integer(secondAssignment.data().generation),
      ) + 1;
      const matchId = `battle-${crypto.randomUUID()}`;
      const match = newMatch(memberIds, profiles, itemCount, generation, now);

      await writeActiveAssignments(
        tx,
        roundRef,
        matchId,
        match,
        now,
        null,
        readyStats,
      );
      tx.set(roundRef.collection("battleMatches").doc(matchId), {
        ...match,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedAtMs: now,
      });
      for (const id of memberIds) {
        tx.update(roundRef.collection("battleStats").doc(id), {
          status: "active",
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }
  });
}

async function loadItems(setId: string) {
  const content = await db.collection("learningSets").doc(setId).collection("content").doc("main").get();
  return items(content.data());
}

export async function issueQuestion(uid: string, input: BattleIssueInput) {
  const { sessionRef, setId, sessionData } = await validateRound(input);
  assertTime(sessionData);
  const allItems = await loadItems(setId);
  const roundRef = sessionRef.collection("rounds").doc(input.roundId);
  const rewardItemId = rollBattleReward();

  return db.runTransaction(async (tx) => {
    const assignmentDoc = await tx.get(roundRef.collection("battleAssignments").doc(uid));
    const raw: unknown = assignmentDoc.data();
    if (
      !isRecord(raw)
      || raw.status !== "active"
      || raw.role !== "attacker"
      || raw.phase !== "choosing"
      || integer(raw.generation) !== input.generation
    ) {
      throw new HttpsError("failed-precondition", "현재 공격 차례가 아닙니다.");
    }

    const matchId = text(raw.matchId);
    const matchRef = roundRef.collection("battleMatches").doc(matchId);
    const match = storedMatch((await tx.get(matchRef)).data());
    if (!match || match.memberIds[match.attackerIndex] !== uid || match.phase !== "choosing") {
      throw new HttpsError("failed-precondition", "배틀 상태가 변경되었습니다.");
    }
    if (match.deadlineAtMs !== null && Date.now() >= match.deadlineAtMs) {
      throw new HttpsError("deadline-exceeded", "문제 선택 시간이 지났습니다.");
    }
    if (match.usedItemIds.includes(input.itemId)) {
      throw new HttpsError("failed-precondition", "이미 사용한 문제입니다.");
    }

    const item = allItems.find((candidate) => candidate.id === input.itemId);
    if (!item) throw new HttpsError("not-found", "선택한 문제를 찾을 수 없습니다.");

    const selected = questionText(item, input.side);
    const now = Date.now();
    const next: StoredBattleMatch = {
      ...match,
      phase: "answering",
      deadlineAtMs: now + ANSWER_MS,
      selectedItemId: item.id,
      selectedSide: input.side,
      prompt: selected.prompt,
      expectedAnswer: selected.expectedAnswer,
      rewardItemId,
      eventRevision: match.eventRevision + 1,
    };

    await writeActiveAssignments(tx, roundRef, matchId, next, now, "question-issued");
    tx.update(matchRef, {
      ...next,
      updatedAt: FieldValue.serverTimestamp(),
      updatedAtMs: now,
    });
    return { accepted: true, rewardAvailable: rewardItemId !== null };
  });
}

async function finalizeJudgment(
  tx: Transaction,
  roundRef: DocumentReference,
  matchRef: DocumentReference,
  matchId: string,
  match: StoredBattleMatch,
  isCorrect: boolean,
  eventType: "correct" | "wrong" | "timeout",
  rewardAccountId: string | null,
): Promise<BattleRewardItemId | null> {
  const now = Date.now();
  const attackerId = match.memberIds[match.attackerIndex];
  const defenderId = match.memberIds[match.defenderIndex];
  if (!attackerId || !defenderId || !match.selectedItemId) {
    throw new HttpsError("failed-precondition", "배틀 참가자 정보가 없습니다.");
  }

  const usedItemIds = match.usedItemIds.includes(match.selectedItemId)
    ? match.usedItemIds
    : [...match.usedItemIds, match.selectedItemId];
  const hearts = {
    ...match.hearts,
    ...(isCorrect
      ? {}
      : { [defenderId]: Math.max(0, (match.hearts[defenderId] ?? HEARTS) - 1) }),
  };
  const revision = match.eventRevision + 1;
  const nextQuestionNumber = match.questionNumber + 1;
  const stats = await statValues(tx, roundRef, match.memberIds);

  if (!isCorrect && hearts[defenderId] === 0) {
    const winner = match.memberProfiles.find((p) => p.playerId === attackerId)
      ?? profile(attackerId, null);
    const loser = match.memberProfiles.find((p) => p.playerId === defenderId)
      ?? profile(defenderId, null);
    const result = {
      outcome: "knockout",
      headline: `${winner.nickname} 승리!`,
      players: [publicProfile(winner), publicProfile(loser)],
    };

    tx.update(matchRef, {
      status: "completed",
      hearts,
      usedItemIds,
      deadlineAtMs: null,
      updatedAt: FieldValue.serverTimestamp(),
      updatedAtMs: now,
    });

    for (const id of match.memberIds) {
      const own = stats.get(id) ?? { kills: 0, deaths: 0, lastOpponentId: null };
      const kills = own.kills + (id === attackerId ? 1 : 0);
      const deaths = own.deaths + (id === defenderId ? 1 : 0);
      tx.set(
        roundRef.collection("battleAssignments").doc(id),
        searchingAssignment({
          playerId: id,
          hearts: id === defenderId ? 0 : hearts[id] ?? HEARTS,
          stats: { kills, deaths },
          itemCount: match.itemCount,
          questionNumber: nextQuestionNumber,
          generation: match.generation,
          eventRevision: revision,
          eventType,
          now,
          resultUntilAtMs: now + RESULT_MS,
          result,
        }),
      );
      tx.update(roundRef.collection("battleStats").doc(id), {
        kills,
        deaths,
        status: "searching",
        lastOpponentId: opponentId(match, id),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    return null;
  }

  let eventRewardItemId: BattleRewardItemId | null = null;
  if (isCorrect && match.rewardItemId === "ink" && rewardAccountId) {
    const reward = await grantStudentItemInTransaction(
      tx,
      rewardAccountId,
      "ink",
      `battle-reward:${matchId}:${nextQuestionNumber}`,
    );
    if (reward.granted || reward.duplicate) eventRewardItemId = "ink";
  }

  if (nextQuestionNumber >= BATTLE_MAX_TURNS) {
    const result = {
      outcome: "joint-win",
      headline: "10턴 생존! 둘 다 승리!",
      players: match.memberProfiles.map(publicProfile),
    };

    tx.update(matchRef, {
      status: "completed",
      hearts,
      usedItemIds,
      deadlineAtMs: null,
      rewardItemId: null,
      updatedAt: FieldValue.serverTimestamp(),
      updatedAtMs: now,
    });

    for (const id of match.memberIds) {
      const own = stats.get(id) ?? { kills: 0, deaths: 0, lastOpponentId: null };
      tx.set(
        roundRef.collection("battleAssignments").doc(id),
        {
          ...searchingAssignment({
            playerId: id,
            hearts: hearts[id] ?? HEARTS,
            stats: { kills: own.kills, deaths: own.deaths },
            itemCount: match.itemCount,
            questionNumber: nextQuestionNumber,
            generation: match.generation,
            eventRevision: revision,
            eventType,
            eventRewardItemId,
            now,
            resultUntilAtMs: now + RESULT_MS,
            result,
          }),
          eventWasMine: id === defenderId,
        },
      );
      tx.update(roundRef.collection("battleStats").doc(id), {
        status: "searching",
        lastOpponentId: opponentId(match, id),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    return eventRewardItemId;
  }

  const nextUsedItemIds = usedItemIds.length >= match.itemCount ? [] : usedItemIds;
  const indices = nextBattleIndices(match.memberIds.length, match.defenderIndex);
  const next: StoredBattleMatch = {
    ...match,
    ...indices,
    hearts,
    usedItemIds: nextUsedItemIds,
    questionNumber: nextQuestionNumber,
    phase: "choosing",
    deadlineAtMs: now + CHOOSE_MS,
    selectedItemId: null,
    selectedSide: null,
    prompt: null,
    expectedAnswer: null,
    gradingSubmissionId: null,
    rewardItemId: null,
    eventRevision: revision,
  };

  await writeActiveAssignments(
    tx,
    roundRef,
    matchId,
    next,
    now,
    eventType,
    stats,
    defenderId,
    eventRewardItemId,
  );
  tx.update(matchRef, {
    ...next,
    updatedAt: FieldValue.serverTimestamp(),
    updatedAtMs: now,
  });
  return eventRewardItemId;
}

export async function submitAnswer(
  uid: string,
  rewardAccountId: string,
  input: BattleSubmitInput,
) {
  const { sessionRef, sessionData } = await validateRound(input);
  assertTime(sessionData);
  const roundRef = sessionRef.collection("rounds").doc(input.roundId);

  const grading = await db.runTransaction(async (tx): Promise<{
    matchId: string;
    prompt: string;
    expected: string;
  }> => {
    const raw: unknown = (
      await tx.get(roundRef.collection("battleAssignments").doc(uid))
    ).data();
    if (
      !isRecord(raw)
      || raw.status !== "active"
      || raw.role !== "defender"
      || raw.phase !== "answering"
      || integer(raw.generation) !== input.generation
    ) {
      throw new HttpsError("failed-precondition", "현재 답할 차례가 아닙니다.");
    }

    const matchId = text(raw.matchId);
    const matchRef = roundRef.collection("battleMatches").doc(matchId);
    const match = storedMatch((await tx.get(matchRef)).data());
    if (
      !match
      || match.phase !== "answering"
      || match.memberIds[match.defenderIndex] !== uid
      || !match.prompt
      || !match.expectedAnswer
    ) {
      throw new HttpsError("failed-precondition", "배틀 문제가 변경되었습니다.");
    }
    if (match.deadlineAtMs !== null && Date.now() >= match.deadlineAtMs) {
      throw new HttpsError("deadline-exceeded", "답변 시간이 지났습니다.");
    }

    const next: StoredBattleMatch = {
      ...match,
      phase: "grading",
      deadlineAtMs: null,
      gradingSubmissionId: input.submissionId,
    };
    await writeActiveAssignments(tx, roundRef, matchId, next, Date.now());
    tx.update(matchRef, {
      phase: "grading",
      deadlineAtMs: null,
      gradingSubmissionId: input.submissionId,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { matchId, prompt: match.prompt, expected: match.expectedAnswer };
  });

  let judged: { readonly isCorrect: boolean; readonly feedback: string };
  try {
    judged = await evaluateBattleAnswer(grading.prompt, grading.expected, input.answer);
  } catch (error: unknown) {
    await db.runTransaction(async (tx) => {
      const ref = roundRef.collection("battleMatches").doc(grading.matchId);
      const match = storedMatch((await tx.get(ref)).data());
      if (
        !match
        || match.phase !== "grading"
        || match.gradingSubmissionId !== input.submissionId
      ) {
        return;
      }
      const next: StoredBattleMatch = {
        ...match,
        phase: "answering",
        deadlineAtMs: Date.now() + ANSWER_MS,
        gradingSubmissionId: null,
      };
      await writeActiveAssignments(tx, roundRef, grading.matchId, next, Date.now());
      tx.update(ref, {
        phase: "answering",
        deadlineAtMs: next.deadlineAtMs,
        gradingSubmissionId: null,
      });
    });
    throw new HttpsError(
      "unavailable",
      error instanceof Error ? error.message : "AI 채점에 실패했습니다.",
    );
  }

  const eventRewardItemId = await db.runTransaction(async (tx) => {
    const ref = roundRef.collection("battleMatches").doc(grading.matchId);
    const match = storedMatch((await tx.get(ref)).data());
    if (
      !match
      || match.phase !== "grading"
      || match.gradingSubmissionId !== input.submissionId
    ) {
      return null;
    }
    return finalizeJudgment(
      tx,
      roundRef,
      ref,
      grading.matchId,
      match,
      judged.isCorrect,
      judged.isCorrect ? "correct" : "wrong",
      judged.isCorrect ? rewardAccountId : null,
    );
  });

  return {
    accepted: true,
    isCorrect: judged.isCorrect,
    rewardItemId: eventRewardItemId,
  };
}

export async function expirePhase(uid: string, input: BattleExpireInput) {
  const { sessionRef, setId, sessionData } = await validateRound(input);
  assertTime(sessionData);
  const allItems = await loadItems(setId);
  const roundRef = sessionRef.collection("rounds").doc(input.roundId);
  const rewardItemId = rollBattleReward();

  return db.runTransaction(async (tx) => {
    const raw: unknown = (
      await tx.get(roundRef.collection("battleAssignments").doc(uid))
    ).data();
    if (
      !isRecord(raw)
      || raw.status !== "active"
      || integer(raw.generation) !== input.generation
      || raw.deadlineAtMs !== input.deadlineAtMs
      || Date.now() < input.deadlineAtMs
    ) {
      return { accepted: false };
    }

    const matchId = text(raw.matchId);
    const ref = roundRef.collection("battleMatches").doc(matchId);
    const match = storedMatch((await tx.get(ref)).data());
    if (
      !match
      || match.deadlineAtMs !== input.deadlineAtMs
      || !match.memberIds.includes(uid)
    ) {
      return { accepted: false };
    }

    if (match.phase === "choosing") {
      const item = allItems.find((candidate) => !match.usedItemIds.includes(candidate.id))
        ?? allItems[match.questionNumber % allItems.length];
      if (!item) return { accepted: false };

      const side = match.questionNumber % 2 === 0 ? "source" : "meaning";
      const selected = questionText(item, side);
      const now = Date.now();
      const next: StoredBattleMatch = {
        ...match,
        phase: "answering",
        deadlineAtMs: now + ANSWER_MS,
        selectedItemId: item.id,
        selectedSide: side,
        prompt: selected.prompt,
        expectedAnswer: selected.expectedAnswer,
        rewardItemId,
        eventRevision: match.eventRevision + 1,
      };
      await writeActiveAssignments(tx, roundRef, matchId, next, now, "question-issued");
      tx.update(ref, {
        ...next,
        updatedAt: FieldValue.serverTimestamp(),
        updatedAtMs: now,
      });
      return { accepted: true };
    }

    if (match.phase === "answering") {
      await finalizeJudgment(
        tx,
        roundRef,
        ref,
        matchId,
        match,
        false,
        "timeout",
        null,
      );
      return { accepted: true };
    }

    return { accepted: false };
  });
}

export async function useBattleItem(
  uid: string,
  accountId: string,
  input: BattleUseItemInput,
) {
  const { sessionRef, sessionData } = await validateRound(input);
  assertTime(sessionData);
  const roundRef = sessionRef.collection("rounds").doc(input.roundId);

  return db.runTransaction(async (tx) => {
    const assignmentDoc = await tx.get(roundRef.collection("battleAssignments").doc(uid));
    const raw: unknown = assignmentDoc.data();
    if (
      !isRecord(raw)
      || raw.status !== "active"
      || integer(raw.generation) !== input.generation
    ) {
      throw new HttpsError("failed-precondition", "현재 배틀에서 아이템을 사용할 수 없습니다.");
    }

    const matchId = text(raw.matchId);
    const matchRef = roundRef.collection("battleMatches").doc(matchId);
    const match = storedMatch((await tx.get(matchRef)).data());
    if (!match || !match.memberIds.includes(uid)) {
      throw new HttpsError("failed-precondition", "배틀 상태가 변경되었습니다.");
    }

    const now = Date.now();
    if (match.deadlineAtMs === null || now >= match.deadlineAtMs) {
      throw new HttpsError("deadline-exceeded", "현재 턴의 시간이 끝났습니다.");
    }

    const targetId = battleInkTargetId(match, uid);
    if (!targetId) {
      throw new HttpsError(
        "failed-precondition",
        "먹물은 상대가 문제를 고르거나 답하고 있을 때 사용할 수 있습니다.",
      );
    }

    const stats = await statValues(tx, roundRef, match.memberIds);
    const consumed = await consumeStudentItemInTransaction(
      tx,
      accountId,
      "ink",
      input.operationId,
    );

    if (consumed.duplicate) {
      return {
        accepted: consumed.consumed,
        consumed: consumed.consumed,
        inventory: consumed.inventory,
      };
    }

    if (!consumed.consumed) {
      return {
        accepted: false,
        consumed: false,
        inventory: consumed.inventory,
      };
    }

    const blockedUntil = Math.max(
      now,
      match.inkBlockedUntilAtMs[targetId] ?? 0,
    ) + BATTLE_INK_BLOCK_MS;
    const next: StoredBattleMatch = {
      ...match,
      inkBlockedUntilAtMs: {
        ...match.inkBlockedUntilAtMs,
        [targetId]: blockedUntil,
      },
      deadlineAtMs: match.deadlineAtMs + BATTLE_INK_BLOCK_MS,
      eventRevision: match.eventRevision + 1,
    };

    await writeActiveAssignments(
      tx,
      roundRef,
      matchId,
      next,
      now,
      "ink-used",
      stats,
      uid,
    );
    tx.update(matchRef, {
      ...next,
      updatedAt: FieldValue.serverTimestamp(),
      updatedAtMs: now,
    });

    return {
      accepted: true,
      consumed: true,
      inventory: consumed.inventory,
    };
  });
}

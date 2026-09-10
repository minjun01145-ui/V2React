import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { db } from "../shared/firebase.js";
import { isRecord } from "../shared/validation.js";
import { shuffled, TEAM_NAMES, teamSizes } from "./model.js";
import type { CooperativeInput, CooperativeSubmitInput, MemberProfile, StoredTeam } from "./types.js";

const GAME_ID = "cooperative-sentence-builder";
const INITIAL_HEARTS = 2;
const TWO_PLAYER_REMATCH_DELAY_MS = 10_000;

function integer(value: unknown): number { return typeof value === "number" && Number.isInteger(value) ? value : 0; }
function string(value: unknown): string { return typeof value === "string" ? value : ""; }
function assignmentGeneration(value: unknown): number { return isRecord(value) ? Math.max(0, integer(value.generation)) : 0; }
function storedTeam(value: unknown): StoredTeam | null {
  if (!isRecord(value) || !Array.isArray(value.memberIds) || !Array.isArray(value.memberProfiles)) return null;
  const status = value.status === "active" || value.status === "completed" || value.status === "eliminated" ? value.status : null;
  const memberIds = value.memberIds.filter((item): item is string => typeof item === "string");
  if (!status || memberIds.length === 0) return null;
  return {
    name: string(value.name), memberIds, memberProfiles: value.memberProfiles as MemberProfile[], memberCount: memberIds.length,
    status, hearts: integer(value.hearts), currentQuestionIndex: integer(value.currentQuestionIndex), questionCount: integer(value.questionCount),
    turnMemberIndex: integer(value.turnMemberIndex), generation: integer(value.generation),
  };
}
function questionItems(value: unknown): readonly Record<string, unknown>[] {
  if (!isRecord(value) || !Array.isArray(value.items)) throw new HttpsError("failed-precondition", "학습 세트 문항을 찾을 수 없습니다.");
  return value.items.filter(isRecord);
}
function expectedTokenIds(item: Record<string, unknown>, fallbackIndex: number): { readonly questionId: string; readonly ids: readonly string[] } {
  const questionId = string(item.id) || `sentence-${fallbackIndex + 1}`;
  const sourceText = string(item.sourceText).trim();
  const chunks = sourceText.split("/").map((chunk) => chunk.trim()).filter(Boolean);
  if (chunks.length < 2) throw new HttpsError("failed-precondition", `${fallbackIndex + 1}번 문항의 끊어읽기 조각이 부족합니다.`);
  return { questionId, ids: chunks.map((_chunk, index) => `${questionId}:chunk:${index}`) };
}
function sameOrder(first: readonly string[], second: readonly string[]): boolean { return first.length === second.length && first.every((item, index) => item === second[index]); }
function profile(playerId: string, value: unknown): MemberProfile {
  const raw = isRecord(value) ? value : {};
  return { playerId, nickname: string(raw.nickname).trim() || "닉네임 없음", avatar: isRecord(raw.avatar) ? raw.avatar : null };
}
function assignmentData(input: { readonly memberId: string; readonly teamId: string; readonly teamName: string; readonly hearts: number; readonly questionCount: number; readonly questionIndex: number; readonly isMyTurn: boolean; readonly generation: number; readonly now: number }) {
  return {
    playerId: input.memberId, teamId: input.teamId, teamName: input.teamName, status: "active", hearts: input.hearts,
    currentQuestionIndex: input.questionIndex, questionCount: input.questionCount, isMyTurn: input.isMyTurn, generation: input.generation,
    searchStartedAtMs: null, revealedPartners: [], updatedAt: FieldValue.serverTimestamp(), updatedAtMs: input.now,
  };
}

async function validateRound(input: CooperativeInput) {
  const sessionRef = db.collection("multiplayerSessions").doc(input.roomId);
  const session = await sessionRef.get();
  const data: unknown = session.exists ? session.data() : null;
  if (!isRecord(data) || data.status !== "playing" || data.roundId !== input.roundId || data.gameId !== GAME_ID) throw new HttpsError("failed-precondition", "진행 중인 협동 문장만들기 라운드가 아닙니다.");
  const setId = isRecord(data.gameConfig) ? string(data.gameConfig.setId) : "";
  if (!setId) throw new HttpsError("failed-precondition", "선택된 끊어읽기 세트가 없습니다.");
  return { sessionRef, setId, sessionData: data };
}

function assertRoundTimeRemaining(sessionData: Record<string, unknown>): void {
  const config = isRecord(sessionData.gameConfig) ? sessionData.gameConfig : {};
  const mode = string(config.timedGameMode) || "3-minutes";
  const durationMs = mode === "unlimited" ? null : mode === "5-minutes" ? 300_000 : 180_000;
  const startedAtMs = typeof sessionData.startedAtMs === "number" ? sessionData.startedAtMs : null;
  if (durationMs !== null && startedAtMs !== null && Date.now() >= startedAtMs + durationMs) throw new HttpsError("failed-precondition", "게임 시간이 종료되었습니다.");
}

export async function ensureRound(input: CooperativeInput): Promise<void> {
  const { sessionRef, setId } = await validateRound(input);
  const metadata = await db.collection("learningSets").doc(setId).get();
  const content = await db.collection("learningSets").doc(setId).collection("content").doc("main").get();
  const metadataData: unknown = metadata.exists ? metadata.data() : null;
  if (!isRecord(metadataData) || metadataData.type !== "reading-chunks") throw new HttpsError("failed-precondition", "협동 문장만들기는 끊어읽기 세트만 사용할 수 있습니다.");
  const questionCount = questionItems(content.exists ? content.data() : null).length;
  if (questionCount === 0) throw new HttpsError("failed-precondition", "세트에 문항이 없습니다.");
  const roundRef = sessionRef.collection("rounds").doc(input.roundId);
  await db.runTransaction(async (tx) => {
    const metaRef = roundRef.collection("cooperativeState").doc("main");
    const meta = await tx.get(metaRef);
    if (meta.exists) return;
    const participants = await tx.get(roundRef.collection("participants"));
    const ids = participants.docs.map((item) => item.id);
    const players = await Promise.all(ids.map((id) => tx.get(sessionRef.collection("players").doc(id))));
    const randomized = shuffled(ids);
    const sizes = teamSizes(randomized.length);
    const names = shuffled(TEAM_NAMES);
    let offset = 0;
    for (const [teamIndex, size] of sizes.entries()) {
      const memberIds = randomized.slice(offset, offset + size);
      offset += size;
      if (memberIds.length === 1) {
        const memberId = memberIds[0];
        if (memberId) tx.set(roundRef.collection("cooperativeAssignments").doc(memberId), { playerId: memberId, teamId: null, teamName: null, status: "searching", hearts: 0, currentQuestionIndex: 0, questionCount, isMyTurn: false, generation: 0, searchStartedAtMs: Date.now(), revealedPartners: [], updatedAt: FieldValue.serverTimestamp(), updatedAtMs: Date.now() });
        continue;
      }
      const teamId = `team-${crypto.randomUUID()}`;
      const name = names[teamIndex % names.length] ?? `food-${teamIndex + 1}`;
      const now = Date.now();
      const memberProfiles = memberIds.map((memberId) => profile(memberId, players[ids.indexOf(memberId)]?.data()));
      tx.set(roundRef.collection("cooperativeTeams").doc(teamId), { name, memberIds, memberProfiles, memberCount: memberIds.length, status: "active", hearts: INITIAL_HEARTS, currentQuestionIndex: 0, questionCount, turnMemberIndex: 0, generation: 1, createdAt: FieldValue.serverTimestamp(), createdAtMs: now, updatedAt: FieldValue.serverTimestamp(), updatedAtMs: now });
      memberIds.forEach((memberId, index) => tx.set(roundRef.collection("cooperativeAssignments").doc(memberId), assignmentData({ memberId, teamId, teamName: name, hearts: INITIAL_HEARTS, questionCount, questionIndex: 0, isMyTurn: index === 0, generation: 1, now })));
    }
    tx.set(metaRef, { gameId: GAME_ID, questionCount, initializedAt: FieldValue.serverTimestamp(), initializedAtMs: Date.now() });
  });
}

export async function refreshMatch(input: CooperativeInput): Promise<void> {
  await validateRound(input);
  const roundRef = db.collection("multiplayerSessions").doc(input.roomId).collection("rounds").doc(input.roundId);
  await db.runTransaction(async (tx) => {
    const state = await tx.get(roundRef.collection("cooperativeState").doc("main"));
    if (!state.exists) return;
    const assignments = await tx.get(roundRef.collection("cooperativeAssignments").where("status", "==", "searching"));
    const teams = await tx.get(roundRef.collection("cooperativeTeams"));
    const searchers = shuffled(assignments.docs);
    if (searchers.length < 2) return;
    const oldest = Math.min(...searchers.map((item) => isRecord(item.data()) && typeof item.data().searchStartedAtMs === "number" ? item.data().searchStartedAtMs as number : Date.now()));
    if (searchers.length === 2 && Date.now() - oldest < TWO_PLAYER_REMATCH_DELAY_MS) return;
    const stateData: unknown = state.data();
    const questionCount = isRecord(stateData) ? integer(stateData.questionCount) : 0;
    const sessionRef = db.collection("multiplayerSessions").doc(input.roomId);
    const playerDocs = await Promise.all(searchers.map((item) => tx.get(sessionRef.collection("players").doc(item.id))));
    const profilesById = new Map(searchers.map((item, index) => [item.id, profile(item.id, playerDocs[index]?.data())]));
    const usedNames = new Set(teams.docs.map((item) => string(item.data().name)));
    const names = shuffled(TEAM_NAMES.filter((name) => !usedNames.has(name)).length > 0 ? TEAM_NAMES.filter((name) => !usedNames.has(name)) : TEAM_NAMES);
    const sizes = teamSizes(searchers.length);
    let offset = 0;
    for (const [teamIndex, size] of sizes.entries()) {
      const members = searchers.slice(offset, offset + size);
      offset += size;
      if (members.length < 2) continue;
      const memberIds = members.map((item) => item.id);
      const teamId = `team-${crypto.randomUUID()}`;
      const name = names[teamIndex % names.length] ?? `food-${teamIndex + 1}`;
      const generation = Math.max(...members.map((item) => assignmentGeneration(item.data()))) + 1;
      const memberProfiles = memberIds.map((id) => profilesById.get(id) ?? profile(id, null));
      const now = Date.now();
      tx.set(roundRef.collection("cooperativeTeams").doc(teamId), { name, memberIds, memberProfiles, memberCount: memberIds.length, status: "active", hearts: INITIAL_HEARTS, currentQuestionIndex: 0, questionCount, turnMemberIndex: 0, generation, createdAt: FieldValue.serverTimestamp(), createdAtMs: now, updatedAt: FieldValue.serverTimestamp(), updatedAtMs: now });
      members.forEach((member, index) => tx.set(member.ref, assignmentData({ memberId: member.id, teamId, teamName: name, hearts: INITIAL_HEARTS, questionCount, questionIndex: 0, isMyTurn: index === 0, generation, now })));
    }
  });
}

export async function submitSentence(uid: string, input: CooperativeSubmitInput) {
  const { sessionRef, setId, sessionData } = await validateRound(input);
  assertRoundTimeRemaining(sessionData);
  const content = await db.collection("learningSets").doc(setId).collection("content").doc("main").get();
  const items = questionItems(content.exists ? content.data() : null);
  const roundRef = sessionRef.collection("rounds").doc(input.roundId);
  return db.runTransaction(async (tx) => {
    const operationRef = roundRef.collection("cooperativeOperations").doc(uid).collection("items").doc(input.submissionId);
    const operation = await tx.get(operationRef);
    if (operation.exists) {
      const stored: unknown = operation.data();
      if (isRecord(stored) && stored.questionId === input.questionId && typeof stored.isCorrect === "boolean") return { isCorrect: stored.isCorrect, eliminated: stored.eliminated === true, completed: stored.completed === true };
      throw new HttpsError("already-exists", "같은 제출 번호가 다른 작업에 사용되었습니다.");
    }
    const assignmentRef = roundRef.collection("cooperativeAssignments").doc(uid);
    const assignment = await tx.get(assignmentRef);
    const assignmentDataRaw: unknown = assignment.exists ? assignment.data() : null;
    if (!isRecord(assignmentDataRaw) || assignmentDataRaw.status !== "active" || assignmentDataRaw.isMyTurn !== true || integer(assignmentDataRaw.generation) !== input.generation) throw new HttpsError("failed-precondition", "현재 이 학생의 차례가 아닙니다.");
    const teamId = string(assignmentDataRaw.teamId);
    const teamRef = roundRef.collection("cooperativeTeams").doc(teamId);
    const teamSnapshot = await tx.get(teamRef);
    const team = storedTeam(teamSnapshot.exists ? teamSnapshot.data() : null);
    if (!team || team.status !== "active" || team.memberIds[team.turnMemberIndex] !== uid) throw new HttpsError("failed-precondition", "현재 조 상태가 변경되었습니다.");
    const memberAssignments = await Promise.all(team.memberIds.map((memberId) => tx.get(roundRef.collection("cooperativeAssignments").doc(memberId))));
    const item = items[team.currentQuestionIndex];
    if (!item) throw new HttpsError("failed-precondition", "현재 문항을 찾을 수 없습니다.");
    const expected = expectedTokenIds(item, team.currentQuestionIndex);
    if (input.questionId !== expected.questionId) throw new HttpsError("failed-precondition", "이미 다음 문항으로 이동했습니다.");
    const isCorrect = sameOrder(input.tokenIds, expected.ids);
    const now = Date.now();
    if (!isCorrect) {
      const hearts = Math.max(0, team.hearts - 1);
      if (hearts === 0) {
        tx.update(teamRef, { status: "eliminated", hearts: 0, updatedAt: FieldValue.serverTimestamp(), updatedAtMs: now });
        memberAssignments.forEach((member) => tx.set(member.ref, { playerId: member.id, teamId: null, teamName: null, status: "searching", hearts: 0, currentQuestionIndex: 0, questionCount: team.questionCount, isMyTurn: false, generation: team.generation, searchStartedAtMs: now, revealedPartners: [], updatedAt: FieldValue.serverTimestamp(), updatedAtMs: now }));
        const result = { isCorrect: false, eliminated: true, completed: false };
        tx.set(operationRef, { ...result, playerId: uid, questionId: input.questionId, createdAt: FieldValue.serverTimestamp(), createdAtMs: now });
        return result;
      }
      tx.update(teamRef, { hearts, updatedAt: FieldValue.serverTimestamp(), updatedAtMs: now });
      memberAssignments.forEach((member) => tx.update(member.ref, { hearts, updatedAt: FieldValue.serverTimestamp(), updatedAtMs: now }));
      const result = { isCorrect: false, eliminated: false, completed: false };
      tx.set(operationRef, { ...result, playerId: uid, questionId: input.questionId, createdAt: FieldValue.serverTimestamp(), createdAtMs: now });
      return result;
    }
    const nextQuestionIndex = team.currentQuestionIndex + 1;
    if (nextQuestionIndex >= team.questionCount) {
      tx.update(teamRef, { status: "completed", currentQuestionIndex: team.questionCount, updatedAt: FieldValue.serverTimestamp(), updatedAtMs: now });
      memberAssignments.forEach((member) => tx.update(member.ref, { status: "completed", currentQuestionIndex: team.questionCount, isMyTurn: false, revealedPartners: team.memberProfiles.filter((partner) => partner.playerId !== member.id), updatedAt: FieldValue.serverTimestamp(), updatedAtMs: now }));
      const result = { isCorrect: true, eliminated: false, completed: true };
      tx.set(operationRef, { ...result, playerId: uid, questionId: input.questionId, createdAt: FieldValue.serverTimestamp(), createdAtMs: now });
      return result;
    }
    const turnMemberIndex = (team.turnMemberIndex + 1) % team.memberIds.length;
    tx.update(teamRef, { currentQuestionIndex: nextQuestionIndex, turnMemberIndex, updatedAt: FieldValue.serverTimestamp(), updatedAtMs: now });
    memberAssignments.forEach((member, index) => tx.update(member.ref, { currentQuestionIndex: nextQuestionIndex, isMyTurn: index === turnMemberIndex, updatedAt: FieldValue.serverTimestamp(), updatedAtMs: now }));
    const result = { isCorrect: true, eliminated: false, completed: false };
    tx.set(operationRef, { ...result, playerId: uid, questionId: input.questionId, createdAt: FieldValue.serverTimestamp(), createdAtMs: now });
    return result;
  });
}

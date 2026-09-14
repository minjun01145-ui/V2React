import { FieldValue, type DocumentReference, type Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { db } from "../shared/firebase.js";
import { isRecord } from "../shared/validation.js";
import { evaluateBattleAnswer } from "./aiEvaluator.js";
import { battleGroupSizes, displayName, nextBattleIndices, questionText, shuffled } from "./model.js";
import type { BattleExpireInput, BattleInput, BattleIssueInput, BattleItem, BattleProfile, BattleSubmitInput, StoredBattleMatch } from "./types.js";

const GAME_ID = "one-on-one-battle";
const HEARTS = 2;
const CHOOSE_MS = 10_000;
const ANSWER_MS = 20_000;
const REMATCH_MS = 20_000;
const RESULT_MS = 4_500;
function integer(value: unknown): number { return typeof value === "number" && Number.isInteger(value) ? value : 0; }
function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function profile(playerId: string, value: unknown): BattleProfile { const raw = isRecord(value) ? value : {}; return { playerId, nickname: displayName(raw.nickname, raw.displayName), avatar: isRecord(raw.avatar) ? raw.avatar : null }; }
function items(value: unknown): BattleItem[] {
  if (!isRecord(value) || !Array.isArray(value.items)) throw new HttpsError("failed-precondition", "학습 세트 문항을 찾을 수 없습니다.");
  return value.items.flatMap((raw, index) => {
    if (!isRecord(raw)) return [];
    const source = text(raw.sourceText).replaceAll("/", " ").replace(/\s+/g, " "); const meaning = text(raw.meaning);
    return source && meaning ? [{ id: text(raw.id) || `item-${index + 1}`, source, meaning }] : [];
  });
}
function storedMatch(value: unknown): StoredBattleMatch | null {
  if (!isRecord(value) || !Array.isArray(value.memberIds) || !Array.isArray(value.memberProfiles) || !isRecord(value.hearts)) return null;
  const memberIds = value.memberIds.filter((item): item is string => typeof item === "string");
  const phase = value.phase === "choosing" || value.phase === "answering" || value.phase === "grading" ? value.phase : null;
  const selectedSide = value.selectedSide === "source" || value.selectedSide === "meaning" ? value.selectedSide : null;
  if (memberIds.length < 2 || !phase) return null;
  const rawHearts = value.hearts;
  return { memberIds, memberProfiles: value.memberProfiles as BattleProfile[], hearts: Object.fromEntries(memberIds.map((id) => [id, Math.max(0, integer(rawHearts[id]))])), usedItemIds: Array.isArray(value.usedItemIds) ? value.usedItemIds.filter((item): item is string => typeof item === "string") : [], itemCount: integer(value.itemCount), questionNumber: integer(value.questionNumber), attackerIndex: integer(value.attackerIndex), defenderIndex: integer(value.defenderIndex), generation: integer(value.generation), phase, deadlineAtMs: typeof value.deadlineAtMs === "number" ? value.deadlineAtMs : null, selectedItemId: text(value.selectedItemId) || null, selectedSide, prompt: text(value.prompt) || null, expectedAnswer: text(value.expectedAnswer) || null, gradingSubmissionId: text(value.gradingSubmissionId) || null, eventRevision: integer(value.eventRevision) };
}
async function validateRound(input: BattleInput) {
  const sessionRef = db.collection("multiplayerSessions").doc(input.roomId); const session = await sessionRef.get(); const data: unknown = session.data();
  if (!isRecord(data) || data.status !== "playing" || data.roundId !== input.roundId || data.gameId !== GAME_ID) throw new HttpsError("failed-precondition", "진행 중인 1:1 배틀 라운드가 아닙니다.");
  const setId = isRecord(data.gameConfig) ? text(data.gameConfig.setId) : "";
  if (!setId) throw new HttpsError("failed-precondition", "선택된 학습 세트가 없습니다.");
  return { sessionRef, setId, sessionData: data };
}
function assertTime(data: Record<string, unknown>) { const config = isRecord(data.gameConfig) ? data.gameConfig : {}; const mode = text(config.timedGameMode) || "3-minutes"; const duration = mode === "unlimited" ? null : mode === "5-minutes" ? 300_000 : 180_000; const start = typeof data.startedAtMs === "number" ? data.startedAtMs : null; if (duration !== null && start !== null && Date.now() >= start + duration) throw new HttpsError("failed-precondition", "게임 시간이 종료되었습니다."); }
function assignment(input: { readonly playerId: string; readonly matchId: string; readonly match: StoredBattleMatch; readonly stats: { readonly kills: number; readonly deaths: number }; readonly now: number; readonly eventType?: string | null; readonly eventActorId?: string | null }) {
  const attackerId = input.match.memberIds[input.match.attackerIndex]; const defenderId = input.match.memberIds[input.match.defenderIndex];
  return { playerId: input.playerId, matchId: input.matchId, status: "active", phase: input.match.phase, role: input.playerId === attackerId ? "attacker" : input.playerId === defenderId ? "defender" : "waiting", hearts: input.match.hearts[input.playerId] ?? HEARTS, kills: input.stats.kills, deaths: input.stats.deaths, itemCount: input.match.itemCount, questionNumber: input.match.questionNumber, usedItemIds: input.match.usedItemIds, generation: input.match.generation, deadlineAtMs: input.match.deadlineAtMs, prompt: input.match.prompt, selectedItemId: input.match.selectedItemId, selectedSide: input.match.selectedSide, eventRevision: input.match.eventRevision, eventType: input.eventType ?? null, eventWasMine: Boolean(input.eventActorId) && input.playerId === input.eventActorId, searchStartedAtMs: null, resultUntilAtMs: null, result: null, updatedAt: FieldValue.serverTimestamp(), updatedAtMs: input.now };
}
async function statValues(tx: Transaction, roundRef: DocumentReference, ids: readonly string[]) { const docs = await Promise.all(ids.map((id) => tx.get(roundRef.collection("battleStats").doc(id)))); return new Map(docs.map((doc) => [doc.id, { kills: integer(doc.data()?.kills), deaths: integer(doc.data()?.deaths) }])); }
async function writeActiveAssignments(tx: Transaction, roundRef: DocumentReference, matchId: string, match: StoredBattleMatch, now: number, eventType: string | null = null, knownStats?: Map<string, { kills: number; deaths: number }>, eventActorId: string | null = null) { const stats = knownStats ?? await statValues(tx, roundRef, match.memberIds); for (const id of match.memberIds) tx.set(roundRef.collection("battleAssignments").doc(id), assignment({ playerId: id, matchId, match, stats: stats.get(id) ?? { kills: 0, deaths: 0 }, now, eventType, eventActorId })); }
function publicProfile(profileValue: BattleProfile) { return { nickname: profileValue.nickname, avatar: profileValue.avatar }; }

export async function ensureRound(input: BattleInput): Promise<void> {
  const { sessionRef, setId } = await validateRound(input); const metadata = await db.collection("learningSets").doc(setId).get(); const content = await db.collection("learningSets").doc(setId).collection("content").doc("main").get(); const meta: unknown = metadata.data();
  if (!isRecord(meta) || (meta.type !== "vocabulary" && meta.type !== "reading-chunks")) throw new HttpsError("failed-precondition", "1:1 배틀은 단어 또는 끊어읽기 세트가 필요합니다.");
  const itemCount = items(content.data()).length; if (!itemCount) throw new HttpsError("failed-precondition", "세트에 문항이 없습니다.");
  const roundRef = sessionRef.collection("rounds").doc(input.roundId);
  await db.runTransaction(async (tx) => {
    const stateRef = roundRef.collection("battleState").doc("main"); if ((await tx.get(stateRef)).exists) return;
    const participants = await tx.get(roundRef.collection("participants")); const ids = shuffled(participants.docs.map((doc) => doc.id)); const playerDocs = await Promise.all(ids.map((id) => tx.get(sessionRef.collection("players").doc(id)))); const profiles = new Map(ids.map((id, index) => [id, profile(id, playerDocs[index]?.data())]));
    for (const id of ids) { const p = profiles.get(id) ?? profile(id, null); tx.set(roundRef.collection("battleStats").doc(id), { ...p, kills: 0, deaths: 0, status: "active", updatedAt: FieldValue.serverTimestamp() }); }
    let offset = 0;
    for (const size of battleGroupSizes(ids.length)) {
      const memberIds = ids.slice(offset, offset + size); offset += size; const now = Date.now();
      if (memberIds.length < 2) { const id = memberIds[0]; if (id) { tx.set(roundRef.collection("battleAssignments").doc(id), { playerId: id, matchId: null, status: "searching", phase: null, role: "waiting", hearts: HEARTS, kills: 0, deaths: 0, itemCount, questionNumber: 0, usedItemIds: [], generation: 0, deadlineAtMs: null, prompt: null, selectedItemId: null, selectedSide: null, eventRevision: 0, eventType: null, searchStartedAtMs: now, resultUntilAtMs: null, result: null, updatedAtMs: now }); tx.update(roundRef.collection("battleStats").doc(id), { status: "searching" }); } continue; }
      const matchId = `battle-${crypto.randomUUID()}`; const match: StoredBattleMatch = { memberIds, memberProfiles: memberIds.map((id) => profiles.get(id) ?? profile(id, null)), hearts: Object.fromEntries(memberIds.map((id) => [id, HEARTS])), usedItemIds: [], itemCount, questionNumber: 0, attackerIndex: 0, defenderIndex: 1, generation: 1, phase: "choosing", deadlineAtMs: now + CHOOSE_MS, selectedItemId: null, selectedSide: null, prompt: null, expectedAnswer: null, gradingSubmissionId: null, eventRevision: 0 };
      tx.set(roundRef.collection("battleMatches").doc(matchId), { ...match, status: "active", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedAtMs: now });
      for (const id of memberIds) tx.set(roundRef.collection("battleAssignments").doc(id), assignment({ playerId: id, matchId, match, stats: { kills: 0, deaths: 0 }, now }));
    }
    tx.set(stateRef, { gameId: GAME_ID, itemCount, initializedAt: FieldValue.serverTimestamp(), initializedAtMs: Date.now() });
  });
}

export async function refreshMatch(input: BattleInput): Promise<void> {
  const { sessionRef } = await validateRound(input); const roundRef = sessionRef.collection("rounds").doc(input.roundId);
  await db.runTransaction(async (tx) => {
    const state = await tx.get(roundRef.collection("battleState").doc("main")); if (!state.exists) return; const itemCount = integer(state.data()?.itemCount);
    const waiting = shuffled((await tx.get(roundRef.collection("battleAssignments").where("status", "==", "searching"))).docs); if (waiting.length < 2) return;
    const ready = waiting.filter((doc) => Date.now() - (typeof doc.data().searchStartedAtMs === "number" ? doc.data().searchStartedAtMs : Date.now()) >= REMATCH_MS); if (ready.length < 2) return;
    const playerDocs = await Promise.all(ready.map((doc) => tx.get(sessionRef.collection("players").doc(doc.id)))); const profiles = new Map(ready.map((doc, index) => [doc.id, profile(doc.id, playerDocs[index]?.data())])); const readyStats = await statValues(tx, roundRef, ready.map((doc) => doc.id)); let offset = 0;
    for (const size of battleGroupSizes(ready.length)) {
      const members = ready.slice(offset, offset + size); offset += size; if (members.length < 2) continue; const memberIds = members.map((doc) => doc.id); const now = Date.now(); const generation = Math.max(...members.map((doc) => integer(doc.data().generation))) + 1; const matchId = `battle-${crypto.randomUUID()}`;
      const match: StoredBattleMatch = { memberIds, memberProfiles: memberIds.map((id) => profiles.get(id) ?? profile(id, null)), hearts: Object.fromEntries(memberIds.map((id) => [id, HEARTS])), usedItemIds: [], itemCount, questionNumber: 0, attackerIndex: 0, defenderIndex: 1, generation, phase: "choosing", deadlineAtMs: now + CHOOSE_MS, selectedItemId: null, selectedSide: null, prompt: null, expectedAnswer: null, gradingSubmissionId: null, eventRevision: 0 };
      await writeActiveAssignments(tx, roundRef, matchId, match, now, null, readyStats); tx.set(roundRef.collection("battleMatches").doc(matchId), { ...match, status: "active", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedAtMs: now }); for (const id of memberIds) tx.update(roundRef.collection("battleStats").doc(id), { status: "active" });
    }
  });
}

async function loadItems(setId: string) { return items((await db.collection("learningSets").doc(setId).collection("content").doc("main").get()).data()); }
export async function issueQuestion(uid: string, input: BattleIssueInput) {
  const { sessionRef, setId, sessionData } = await validateRound(input); assertTime(sessionData); const allItems = await loadItems(setId); const roundRef = sessionRef.collection("rounds").doc(input.roundId);
  return db.runTransaction(async (tx) => {
    const assignmentDoc = await tx.get(roundRef.collection("battleAssignments").doc(uid)); const raw: unknown = assignmentDoc.data(); if (!isRecord(raw) || raw.status !== "active" || raw.role !== "attacker" || raw.phase !== "choosing" || integer(raw.generation) !== input.generation) throw new HttpsError("failed-precondition", "현재 공격 차례가 아닙니다.");
    const matchId = text(raw.matchId); const matchRef = roundRef.collection("battleMatches").doc(matchId); const match = storedMatch((await tx.get(matchRef)).data()); if (!match || match.memberIds[match.attackerIndex] !== uid || match.phase !== "choosing") throw new HttpsError("failed-precondition", "배틀 상태가 변경되었습니다.");
    if (match.deadlineAtMs !== null && Date.now() >= match.deadlineAtMs) throw new HttpsError("deadline-exceeded", "문제 선택 시간이 지났습니다."); if (match.usedItemIds.includes(input.itemId)) throw new HttpsError("failed-precondition", "이미 사용한 문제입니다."); const item = allItems.find((candidate) => candidate.id === input.itemId); if (!item) throw new HttpsError("not-found", "선택한 문제를 찾을 수 없습니다."); const selected = questionText(item, input.side); const now = Date.now(); const next: StoredBattleMatch = { ...match, phase: "answering", deadlineAtMs: now + ANSWER_MS, selectedItemId: item.id, selectedSide: input.side, prompt: selected.prompt, expectedAnswer: selected.expectedAnswer, eventRevision: match.eventRevision + 1 };
    await writeActiveAssignments(tx, roundRef, matchId, next, now, "question-issued"); tx.update(matchRef, { ...next, updatedAt: FieldValue.serverTimestamp(), updatedAtMs: now }); return { accepted: true };
  });
}

async function finalizeJudgment(tx: Transaction, roundRef: DocumentReference, matchRef: DocumentReference, matchId: string, match: StoredBattleMatch, isCorrect: boolean, eventType: "correct" | "wrong" | "timeout") {
  const now = Date.now(); const attackerId = match.memberIds[match.attackerIndex]; const defenderId = match.memberIds[match.defenderIndex]; if (!attackerId || !defenderId || !match.selectedItemId) throw new HttpsError("failed-precondition", "배틀 참가자 정보가 없습니다.");
  const usedItemIds = match.usedItemIds.includes(match.selectedItemId) ? match.usedItemIds : [...match.usedItemIds, match.selectedItemId]; const hearts = { ...match.hearts, ...(isCorrect ? {} : { [defenderId]: Math.max(0, (match.hearts[defenderId] ?? HEARTS) - 1) }) }; const revision = match.eventRevision + 1;
  const stats = await statValues(tx, roundRef, match.memberIds);
  if (!isCorrect && hearts[defenderId] === 0) {
    const winner = match.memberProfiles.find((p) => p.playerId === attackerId) ?? profile(attackerId, null); const loser = match.memberProfiles.find((p) => p.playerId === defenderId) ?? profile(defenderId, null); const result = { outcome: "knockout", headline: `${winner.nickname} 승리!`, players: [publicProfile(winner), publicProfile(loser)] }; const searchStartedAtMs = now;
    tx.update(matchRef, { status: "completed", hearts, usedItemIds, deadlineAtMs: null, updatedAt: FieldValue.serverTimestamp(), updatedAtMs: now });
    for (const id of match.memberIds) { const own = stats.get(id) ?? { kills: 0, deaths: 0 }; const kills = own.kills + (id === attackerId ? 1 : 0); const deaths = own.deaths + (id === defenderId ? 1 : 0); tx.set(roundRef.collection("battleAssignments").doc(id), { playerId: id, matchId: null, status: "searching", phase: null, role: "waiting", hearts: id === defenderId ? 0 : hearts[id] ?? HEARTS, kills, deaths, itemCount: match.itemCount, questionNumber: match.questionNumber + 1, usedItemIds: [], generation: match.generation, deadlineAtMs: null, prompt: null, selectedItemId: null, selectedSide: null, eventRevision: revision, eventType, searchStartedAtMs, resultUntilAtMs: now + RESULT_MS, result, updatedAt: FieldValue.serverTimestamp(), updatedAtMs: now }); tx.update(roundRef.collection("battleStats").doc(id), { kills, deaths, status: "searching", updatedAt: FieldValue.serverTimestamp() }); }
    return;
  }
  if (usedItemIds.length >= match.itemCount) {
    const result = { outcome: "draw", headline: "끝까지 살아남아 공동 승리!", players: match.memberProfiles.map(publicProfile) }; tx.update(matchRef, { status: "completed", hearts, usedItemIds, deadlineAtMs: null, updatedAt: FieldValue.serverTimestamp(), updatedAtMs: now });
    for (const id of match.memberIds) { const own = stats.get(id) ?? { kills: 0, deaths: 0 }; tx.set(roundRef.collection("battleAssignments").doc(id), { playerId: id, matchId, status: "completed", phase: null, role: "waiting", hearts: hearts[id] ?? HEARTS, ...own, itemCount: match.itemCount, questionNumber: match.itemCount, usedItemIds, generation: match.generation, deadlineAtMs: null, prompt: null, selectedItemId: null, selectedSide: null, eventRevision: revision, eventType, searchStartedAtMs: null, resultUntilAtMs: null, result, updatedAt: FieldValue.serverTimestamp(), updatedAtMs: now }); tx.update(roundRef.collection("battleStats").doc(id), { status: "completed", updatedAt: FieldValue.serverTimestamp() }); }
    return;
  }
  const indices = nextBattleIndices(match.memberIds.length, match.defenderIndex); const next: StoredBattleMatch = { ...match, ...indices, hearts, usedItemIds, questionNumber: match.questionNumber + 1, phase: "choosing", deadlineAtMs: now + CHOOSE_MS, selectedItemId: null, selectedSide: null, prompt: null, expectedAnswer: null, gradingSubmissionId: null, eventRevision: revision }; await writeActiveAssignments(tx, roundRef, matchId, next, now, eventType, stats, defenderId); tx.update(matchRef, { ...next, updatedAt: FieldValue.serverTimestamp(), updatedAtMs: now });
}

export async function submitAnswer(uid: string, input: BattleSubmitInput) {
  const { sessionRef, sessionData } = await validateRound(input); assertTime(sessionData); const roundRef = sessionRef.collection("rounds").doc(input.roundId);
  const grading = await db.runTransaction(async (tx): Promise<{ matchId: string; prompt: string; expected: string }> => { const raw: unknown = (await tx.get(roundRef.collection("battleAssignments").doc(uid))).data(); if (!isRecord(raw) || raw.status !== "active" || raw.role !== "defender" || raw.phase !== "answering" || integer(raw.generation) !== input.generation) throw new HttpsError("failed-precondition", "현재 답할 차례가 아닙니다."); const matchId = text(raw.matchId); const matchRef = roundRef.collection("battleMatches").doc(matchId); const match = storedMatch((await tx.get(matchRef)).data()); if (!match || match.phase !== "answering" || match.memberIds[match.defenderIndex] !== uid || !match.prompt || !match.expectedAnswer) throw new HttpsError("failed-precondition", "배틀 문제가 변경되었습니다."); if (match.deadlineAtMs !== null && Date.now() >= match.deadlineAtMs) throw new HttpsError("deadline-exceeded", "답변 시간이 지났습니다."); const next = { ...match, phase: "grading" as const, deadlineAtMs: null, gradingSubmissionId: input.submissionId }; await writeActiveAssignments(tx, roundRef, matchId, next, Date.now()); tx.update(matchRef, { phase: "grading", deadlineAtMs: null, gradingSubmissionId: input.submissionId, updatedAt: FieldValue.serverTimestamp() }); return { matchId, prompt: match.prompt, expected: match.expectedAnswer }; });
  let judged: { readonly isCorrect: boolean; readonly feedback: string };
  try { judged = await evaluateBattleAnswer(grading.prompt, grading.expected, input.answer); }
  catch (error: unknown) { await db.runTransaction(async (tx) => { const ref = roundRef.collection("battleMatches").doc(grading.matchId); const match = storedMatch((await tx.get(ref)).data()); if (!match || match.phase !== "grading" || match.gradingSubmissionId !== input.submissionId) return; const next = { ...match, phase: "answering" as const, deadlineAtMs: Date.now() + ANSWER_MS, gradingSubmissionId: null }; await writeActiveAssignments(tx, roundRef, grading.matchId, next, Date.now()); tx.update(ref, { phase: "answering", deadlineAtMs: next.deadlineAtMs, gradingSubmissionId: null }); }); throw new HttpsError("unavailable", error instanceof Error ? error.message : "AI 채점에 실패했습니다."); }
  await db.runTransaction(async (tx) => { const ref = roundRef.collection("battleMatches").doc(grading.matchId); const match = storedMatch((await tx.get(ref)).data()); if (!match || match.phase !== "grading" || match.gradingSubmissionId !== input.submissionId) return; await finalizeJudgment(tx, roundRef, ref, grading.matchId, match, judged.isCorrect, judged.isCorrect ? "correct" : "wrong"); }); return { accepted: true, isCorrect: judged.isCorrect };
}

export async function expirePhase(uid: string, input: BattleExpireInput) {
  const { sessionRef, setId, sessionData } = await validateRound(input); assertTime(sessionData); const allItems = await loadItems(setId); const roundRef = sessionRef.collection("rounds").doc(input.roundId);
  return db.runTransaction(async (tx) => { const raw: unknown = (await tx.get(roundRef.collection("battleAssignments").doc(uid))).data(); if (!isRecord(raw) || raw.status !== "active" || integer(raw.generation) !== input.generation || raw.deadlineAtMs !== input.deadlineAtMs || Date.now() < input.deadlineAtMs) return { accepted: false }; const matchId = text(raw.matchId); const ref = roundRef.collection("battleMatches").doc(matchId); const match = storedMatch((await tx.get(ref)).data()); if (!match || match.deadlineAtMs !== input.deadlineAtMs || !match.memberIds.includes(uid)) return { accepted: false };
    if (match.phase === "choosing") { const item = allItems.find((candidate) => !match.usedItemIds.includes(candidate.id)); if (!item) return { accepted: false }; const side = match.questionNumber % 2 === 0 ? "source" : "meaning"; const selected = questionText(item, side); const now = Date.now(); const next: StoredBattleMatch = { ...match, phase: "answering", deadlineAtMs: now + ANSWER_MS, selectedItemId: item.id, selectedSide: side, prompt: selected.prompt, expectedAnswer: selected.expectedAnswer, eventRevision: match.eventRevision + 1 }; await writeActiveAssignments(tx, roundRef, matchId, next, now, "question-issued"); tx.update(ref, { ...next, updatedAt: FieldValue.serverTimestamp(), updatedAtMs: now }); return { accepted: true }; }
    if (match.phase === "answering") { await finalizeJudgment(tx, roundRef, ref, matchId, match, false, "timeout"); return { accepted: true }; } return { accepted: false };
  });
}

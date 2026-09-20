import { collection, doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../firebase/firebaseClient.ts";
import { MULTIPLAYER_COLLECTION } from "../constants.ts";
import type {
  DrawWordUnoCardInput,
  ExpireWordUnoTurnInput,
  PlayWordUnoCardInput,
  WordUnoAssignment,
  WordUnoCard,
  WordUnoMember,
  WordUnoStage,
} from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function integer(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) ? value : 0;
}

function nullableTime(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stage(value: unknown): WordUnoStage | null {
  return value === 1 || value === 2 || value === 3 ? value : null;
}

function forms(value: unknown): readonly [string, string, string] | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const parsed = value.map(text);
  return parsed.every(Boolean) ? [parsed[0]!, parsed[1]!, parsed[2]!] : null;
}

function card(value: unknown): WordUnoCard | null {
  if (!isRecord(value)) return null;
  const id = text(value.id);
  if (!id) return null;
  if (value.kind === "skip" || value.kind === "draw-two" || value.kind === "wild") {
    return { id, kind: value.kind };
  }
  if (value.kind !== "word") return null;
  const wordStage = stage(value.stage);
  const wordText = text(value.text);
  const meaning = text(value.meaning);
  const familyId = text(value.familyId);
  const familyForms = Array.isArray(value.familyForms)
    && value.familyForms.length === 3
    && value.familyForms.every((item) => typeof item === "string" && item.trim())
    ? value.familyForms.map((item) => String(item).trim()) as [string, string, string]
    : undefined;
  return wordStage && wordText && meaning && familyId
    ? { id, kind: "word", text: wordText, meaning, familyId, stage: wordStage, ...(familyForms ? { familyForms } : {}) }
    : null;
}

function member(value: unknown): WordUnoMember | null {
  if (!isRecord(value)) return null;
  const playerId = text(value.playerId);
  const nickname = text(value.nickname);
  if (!playerId || !nickname) return null;
  const rawRank = integer(value.rank);
  return {
    playerId,
    nickname,
    handCount: Math.max(0, integer(value.handCount)),
    rank: rawRank > 0 ? rawRank : null,
  };
}

function assignment(value: unknown): WordUnoAssignment | null {
  if (!isRecord(value)) return null;
  const playerId = text(value.playerId);
  const status = value.status === "active"
    || value.status === "finished"
    || value.status === "completed"
    || value.status === "waiting"
    ? value.status
    : null;
  if (!playerId || !status) return null;
  const rawRank = integer(value.rank);
  return {
    playerId,
    groupId: text(value.groupId) || null,
    groupLabel: text(value.groupLabel) || null,
    status,
    generation: Math.max(0, integer(value.generation)),
    revision: Math.max(0, integer(value.revision)),
    hand: Array.isArray(value.hand)
      ? value.hand.map(card).filter((item): item is WordUnoCard => item !== null)
      : [],
    members: Array.isArray(value.members)
      ? value.members.map(member).filter((item): item is WordUnoMember => item !== null)
      : [],
    topCard: card(value.topCard),
    activeStage: stage(value.activeStage),
    activeFamilyId: text(value.activeFamilyId) || null,
    activeFamilyForms: forms(value.activeFamilyForms),
    currentPlayerId: text(value.currentPlayerId) || null,
    turnDeadlineAtMs: nullableTime(value.turnDeadlineAtMs),
    endsAtMs: nullableTime(value.endsAtMs),
    rank: rawRank > 0 ? rawRank : null,
  };
}

const roundRef = (roomId: string, roundId: string) =>
  doc(db, MULTIPLAYER_COLLECTION, roomId, "rounds", roundId);

export function subscribeWordUnoAssignment(
  roomId: string,
  roundId: string,
  playerId: string,
  onValue: (value: WordUnoAssignment | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(roundRef(roomId, roundId), "wordUnoAssignments", playerId),
    (snapshot) => onValue(snapshot.exists() ? assignment(snapshot.data()) : null),
    onError,
  );
}

export function subscribeWordUnoAssignments(
  roomId: string,
  roundId: string,
  onValue: (value: WordUnoAssignment[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(roundRef(roomId, roundId), "wordUnoAssignments"),
    (snapshot) => onValue(snapshot.docs
      .map((item) => assignment(item.data()))
      .filter((item): item is WordUnoAssignment => item !== null)
      .sort((a, b) => (a.groupLabel ?? "").localeCompare(b.groupLabel ?? "", "ko-KR") || (a.rank ?? 999) - (b.rank ?? 999))),
    onError,
  );
}

async function callAction(name: string, input: Readonly<Record<string, unknown>>): Promise<void> {
  const response = await httpsCallable<Record<string, unknown>, unknown>(functions, name)(input);
  if (isRecord(response.data) && response.data.accepted === false) {
    throw new Error("요청이 적용되지 않았습니다. 최신 게임 상태를 확인해 주세요.");
  }
}

async function callExpiry(name: string, input: Readonly<Record<string, unknown>>): Promise<boolean> {
  const response = await httpsCallable<Record<string, unknown>, unknown>(functions, name)(input);
  return !(isRecord(response.data) && response.data.accepted === false);
}

export async function ensureWordUnoRound(roomId: string, roundId: string): Promise<void> {
  await callAction("ensureWordUnoRound", { roomId, roundId });
}

export async function playWordUnoCard(input: PlayWordUnoCardInput): Promise<void> {
  await callAction("playWordUnoCard", { ...input });
}

export async function drawWordUnoCard(input: DrawWordUnoCardInput): Promise<void> {
  await callAction("drawWordUnoCard", { ...input });
}

export async function expireWordUnoTurn(input: ExpireWordUnoTurnInput): Promise<boolean> {
  return callExpiry("expireWordUnoTurn", { ...input });
}

export async function expireWordUnoRound(roomId: string, roundId: string): Promise<boolean> {
  return callExpiry("expireWordUnoRound", { roomId, roundId });
}

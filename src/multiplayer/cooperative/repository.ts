import { collection, doc, onSnapshot, type DocumentData, type Unsubscribe } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../firebase/firebaseClient.ts";
import { MULTIPLAYER_COLLECTION } from "../constants.ts";
import type { PlayerAvatar } from "../types.ts";
import type { CooperativeAssignment, CooperativeSubmitResult, CooperativeTeam, RevealedPartner } from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function integer(value: unknown): number { return typeof value === "number" && Number.isInteger(value) ? value : 0; }
function avatar(value: unknown): PlayerAvatar | null {
  if (!isRecord(value)) return null;
  if (value.kind === "character" && typeof value.characterId === "string") return { kind: "character", characterId: value.characterId };
  if (value.kind === "pokemon" && typeof value.captureId === "string" && typeof value.name === "string" && typeof value.spriteUrl === "string") {
    return { kind: "pokemon", captureId: value.captureId, name: value.name, spriteUrl: value.spriteUrl, fallbackSpriteUrl: typeof value.fallbackSpriteUrl === "string" ? value.fallbackSpriteUrl : null };
  }
  return null;
}
function partner(value: unknown): RevealedPartner | null {
  if (!isRecord(value)) return null;
  const playerId = text(value.playerId);
  const nickname = text(value.nickname);
  return playerId && nickname ? { playerId, nickname, avatar: avatar(value.avatar) } : null;
}
function assignment(value: unknown): CooperativeAssignment | null {
  if (!isRecord(value)) return null;
  const playerId = text(value.playerId);
  const status = value.status === "active" || value.status === "searching" || value.status === "completed" ? value.status : null;
  if (!playerId || !status) return null;
  return {
    playerId,
    teamId: text(value.teamId) || null,
    teamName: text(value.teamName) || null,
    status,
    hearts: Math.max(0, Math.min(2, integer(value.hearts))),
    currentQuestionIndex: Math.max(0, integer(value.currentQuestionIndex)),
    questionCount: Math.max(0, integer(value.questionCount)),
    isMyTurn: value.isMyTurn === true,
    generation: Math.max(0, integer(value.generation)),
    searchStartedAtMs: typeof value.searchStartedAtMs === "number" ? value.searchStartedAtMs : null,
    revealedPartners: Array.isArray(value.revealedPartners) ? value.revealedPartners.map(partner).filter((item): item is RevealedPartner => item !== null) : [],
  };
}
function team(id: string, value: DocumentData): CooperativeTeam | null {
  const raw: unknown = value;
  if (!isRecord(raw)) return null;
  const status = raw.status === "active" || raw.status === "completed" || raw.status === "eliminated" ? raw.status : null;
  const name = text(raw.name);
  if (!status || !name) return null;
  return { id, name, status, hearts: Math.max(0, Math.min(2, integer(raw.hearts))), currentQuestionIndex: Math.max(0, integer(raw.currentQuestionIndex)), questionCount: Math.max(0, integer(raw.questionCount)), memberCount: Math.max(0, integer(raw.memberCount)), updatedAtMs: typeof raw.updatedAtMs === "number" ? raw.updatedAtMs : 0 };
}

const roundRef = (roomId: string, roundId: string) => doc(db, MULTIPLAYER_COLLECTION, roomId, "rounds", roundId);

export function subscribeCooperativeAssignment(roomId: string, roundId: string, playerId: string, onValue: (value: CooperativeAssignment | null) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(doc(roundRef(roomId, roundId), "cooperativeAssignments", playerId), (snapshot) => onValue(snapshot.exists() ? assignment(snapshot.data()) : null), onError);
}
export function subscribeCooperativeTeams(roomId: string, roundId: string, onValue: (value: CooperativeTeam[]) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(collection(roundRef(roomId, roundId), "cooperativeTeams"), (snapshot) => onValue(snapshot.docs.map((item) => team(item.id, item.data())).filter((item): item is CooperativeTeam => item !== null).sort((a, b) => a.name.localeCompare(b.name))), onError);
}
export async function ensureCooperativeRound(roomId: string, roundId: string): Promise<void> {
  await httpsCallable(functions, "ensureCooperativeRound")({ roomId, roundId });
}
export async function refreshCooperativeMatch(roomId: string, roundId: string): Promise<void> {
  await httpsCallable(functions, "refreshCooperativeMatch")({ roomId, roundId });
}
export async function submitCooperativeSentence(input: { readonly roomId: string; readonly roundId: string; readonly submissionId: string; readonly generation: number; readonly questionId: string; readonly tokenIds: readonly string[] }): Promise<CooperativeSubmitResult> {
  const response = await httpsCallable<typeof input, unknown>(functions, "submitCooperativeSentence")(input);
  const value: unknown = response.data;
  if (!isRecord(value) || typeof value.isCorrect !== "boolean") throw new Error("협동 답안 처리 결과가 올바르지 않습니다.");
  return { isCorrect: value.isCorrect, eliminated: value.eliminated === true, completed: value.completed === true };
}

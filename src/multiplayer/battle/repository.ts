import { collection, doc, onSnapshot, type DocumentData, type Unsubscribe } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../firebase/firebaseClient.ts";
import { parseSharedItemInventory, type SharedItemInventory } from "../../items/inventory.ts";
import { MULTIPLAYER_COLLECTION } from "../constants.ts";
import type { PlayerAvatar } from "../types.ts";
import type { BattleActionResult, BattleAssignment, BattleProfile, BattleResult, BattleStanding } from "./types.ts";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function integer(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) ? value : 0;
}
function avatar(value: unknown): PlayerAvatar | null {
  if (!record(value)) return null;
  if (value.kind === "character" && typeof value.characterId === "string") {
    return { kind: "character", characterId: value.characterId };
  }
  if (
    value.kind === "pokemon"
    && typeof value.captureId === "string"
    && typeof value.name === "string"
    && typeof value.spriteUrl === "string"
  ) {
    return {
      kind: "pokemon",
      captureId: value.captureId,
      name: value.name,
      spriteUrl: value.spriteUrl,
      fallbackSpriteUrl: typeof value.fallbackSpriteUrl === "string"
        ? value.fallbackSpriteUrl
        : null,
    };
  }
  return null;
}
function profile(value: unknown): BattleProfile | null {
  if (!record(value)) return null;
  const nickname = text(value.nickname);
  return nickname ? { nickname, avatar: avatar(value.avatar) } : null;
}
function result(value: unknown): BattleResult | null {
  if (
    !record(value)
    || (value.outcome !== "knockout" && value.outcome !== "draw" && value.outcome !== "joint-win")
    || !Array.isArray(value.players)
  ) {
    return null;
  }
  return {
    outcome: value.outcome,
    headline: text(value.headline),
    players: value.players.map(profile).filter((item): item is BattleProfile => item !== null),
  };
}
function assignment(value: unknown): BattleAssignment | null {
  if (!record(value)) return null;
  const playerId = text(value.playerId);
  const status = value.status === "active" || value.status === "searching" || value.status === "completed"
    ? value.status
    : null;
  const phase = value.phase === "choosing" || value.phase === "answering" || value.phase === "grading"
    ? value.phase
    : null;
  const role = value.role === "attacker" || value.role === "defender" || value.role === "waiting"
    ? value.role
    : "waiting";
  const selectedSide = value.selectedSide === "source" || value.selectedSide === "meaning"
    ? value.selectedSide
    : null;
  const eventType = value.eventType === "question-issued"
    || value.eventType === "correct"
    || value.eventType === "wrong"
    || value.eventType === "timeout"
    || value.eventType === "ink-used"
    ? value.eventType
    : null;
  if (!playerId || !status) return null;

  return {
    playerId,
    matchId: text(value.matchId) || null,
    status,
    phase,
    role,
    hearts: Math.max(0, Math.min(2, integer(value.hearts))),
    kills: Math.max(0, integer(value.kills)),
    deaths: Math.max(0, integer(value.deaths)),
    itemCount: Math.max(0, integer(value.itemCount)),
    questionNumber: Math.max(0, integer(value.questionNumber)),
    turnLimit: Math.max(1, integer(value.turnLimit) || 10),
    usedItemIds: Array.isArray(value.usedItemIds)
      ? value.usedItemIds.filter((item): item is string => typeof item === "string")
      : [],
    generation: Math.max(0, integer(value.generation)),
    deadlineAtMs: typeof value.deadlineAtMs === "number" ? value.deadlineAtMs : null,
    prompt: text(value.prompt) || null,
    selectedItemId: text(value.selectedItemId) || null,
    selectedSide,
    eventRevision: Math.max(0, integer(value.eventRevision)),
    eventType,
    eventWasMine: value.eventWasMine === true,
    eventRewardItemId: value.eventRewardItemId === "ink" ? "ink" : null,
    rewardAvailable: value.rewardAvailable === true,
    inkBlockedUntilAtMs: typeof value.inkBlockedUntilAtMs === "number"
      ? value.inkBlockedUntilAtMs
      : null,
    searchStartedAtMs: typeof value.searchStartedAtMs === "number"
      ? value.searchStartedAtMs
      : null,
    resultUntilAtMs: typeof value.resultUntilAtMs === "number"
      ? value.resultUntilAtMs
      : null,
    result: result(value.result),
  };
}
function standing(id: string, value: DocumentData): BattleStanding | null {
  const raw: unknown = value;
  if (!record(raw)) return null;
  const nickname = text(raw.nickname);
  const status = raw.status === "active" || raw.status === "searching" || raw.status === "completed"
    ? raw.status
    : null;
  return nickname && status
    ? {
        id,
        nickname,
        avatar: avatar(raw.avatar),
        kills: Math.max(0, integer(raw.kills)),
        deaths: Math.max(0, integer(raw.deaths)),
        status,
      }
    : null;
}

const roundRef = (roomId: string, roundId: string) =>
  doc(db, MULTIPLAYER_COLLECTION, roomId, "rounds", roundId);

export function subscribeBattleAssignment(
  roomId: string,
  roundId: string,
  playerId: string,
  onValue: (value: BattleAssignment | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(roundRef(roomId, roundId), "battleAssignments", playerId),
    (snapshot) => onValue(snapshot.exists() ? assignment(snapshot.data()) : null),
    onError,
  );
}

export function subscribeBattleStandings(
  roomId: string,
  roundId: string,
  onValue: (value: BattleStanding[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(roundRef(roomId, roundId), "battleStats"),
    (snapshot) => onValue(
      snapshot.docs
        .map((item) => standing(item.id, item.data()))
        .filter((item): item is BattleStanding => item !== null)
        .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths || a.nickname.localeCompare(b.nickname, "ko")),
    ),
    onError,
  );
}

async function call(
  name: string,
  input: Readonly<Record<string, unknown>>,
): Promise<BattleActionResult> {
  const response = await httpsCallable<Record<string, unknown>, unknown>(functions, name)(input);
  return { accepted: record(response.data) && response.data.accepted !== false };
}

export async function ensureBattleRound(roomId: string, roundId: string) {
  await call("ensureBattleRound", { roomId, roundId });
}
export async function refreshBattleMatch(roomId: string, roundId: string) {
  await call("refreshBattleMatch", { roomId, roundId });
}
export async function issueBattleQuestion(input: {
  readonly roomId: string;
  readonly roundId: string;
  readonly generation: number;
  readonly itemId: string;
  readonly side: "source" | "meaning";
}) {
  return call("issueBattleQuestion", input);
}
export async function submitBattleAnswer(input: {
  readonly roomId: string;
  readonly roundId: string;
  readonly generation: number;
  readonly submissionId: string;
  readonly answer: string;
}) {
  return call("submitBattleAnswer", input);
}
export async function expireBattlePhase(input: {
  readonly roomId: string;
  readonly roundId: string;
  readonly generation: number;
  readonly deadlineAtMs: number;
}) {
  return call("expireBattlePhase", input);
}

export async function useBattleItem(input: {
  readonly roomId: string;
  readonly roundId: string;
  readonly generation: number;
  readonly operationId: string;
  readonly itemId: "ink";
}): Promise<{
  readonly accepted: boolean;
  readonly consumed: boolean;
  readonly inventory: SharedItemInventory;
}> {
  const response = await httpsCallable<Record<string, unknown>, unknown>(
    functions,
    "useBattleItem",
  )(input);
  const data = record(response.data) ? response.data : {};
  return {
    accepted: data.accepted === true,
    consumed: data.consumed === true,
    inventory: parseSharedItemInventory(data.inventory),
  };
}

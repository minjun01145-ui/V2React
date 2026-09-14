import {
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase/firebaseClient.ts";
import { MULTIPLAYER_COLLECTION } from "../multiplayer/constants.ts";
import type { Player } from "../multiplayer/types.ts";
import { displayLabel } from "../multiplayer/types.ts";
import { createDiceResults, DICE_ROLL_ANIMATION_MS, type DiceCount } from "../dice/model.ts";
import { parseWaitingDiceState, type WaitingDiceState } from "./model.ts";

const diceRequestRef = (roomId: string, playerId: string) => doc(db, MULTIPLAYER_COLLECTION, roomId, "waitingDiceRequests", playerId);

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

function randomRequestId(): string {
  return crypto.randomUUID();
}

export function subscribeWaitingDice(
  roomId: string,
  playerId: string,
  onValue: (value: WaitingDiceState | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(diceRequestRef(roomId, playerId), (snapshot) => {
    onValue(snapshot.exists() ? parseWaitingDiceState(snapshot.data()) : null);
  }, onError);
}

export async function requestStudentDiceRoll(
  roomId: string,
  diceCount: DiceCount,
  player: Player,
): Promise<void> {
  const now = Date.now();
  await setDoc(diceRequestRef(roomId, player.id), {
    requestId: randomRequestId(),
    phase: "requested",
    diceCount,
    rollerId: player.id,
    rollerLabel: displayLabel(player.displayName, player.nickname),
    results: [],
    requestedAt: serverTimestamp(),
    requestedAtMs: now,
    updatedAt: serverTimestamp(),
    updatedAtMs: now,
  });
}

export async function cancelStudentDiceRoll(roomId: string, playerId: string): Promise<void> {
  await deleteDoc(diceRequestRef(roomId, playerId));
}

export async function rollRequestedWaitingDice(roomId: string, playerId: string): Promise<void> {
  let acceptedRequestId: string | null = null;
  await runTransaction(db, async (transaction) => {
    const ref = diceRequestRef(roomId, playerId);
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists() ? parseWaitingDiceState(snapshot.data()) : null;
    if (!current || current.phase !== "requested" || current.rollerId !== playerId) {
      throw new Error("현재 나에게 온 주사위 요청이 없습니다.");
    }
    acceptedRequestId = current.requestId;
    transaction.update(ref, {
      phase: "rolling",
      results: [],
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now(),
    });
  });

  await wait(DICE_ROLL_ANIMATION_MS);
  await runTransaction(db, async (transaction) => {
    const ref = diceRequestRef(roomId, playerId);
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists() ? parseWaitingDiceState(snapshot.data()) : null;
    if (!current
      || current.requestId !== acceptedRequestId
      || current.phase !== "rolling"
      || current.rollerId !== playerId) return;
    transaction.update(ref, {
      phase: "result",
      results: createDiceResults(current.diceCount),
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now(),
    });
  });
}

import { deleteField, doc, updateDoc, type Unsubscribe } from "firebase/firestore";
import { db } from "../../firebase/firebaseClient.ts";
import { observeLiveRecords } from "../../live-world/client.ts";
import { MULTIPLAYER_COLLECTION } from "../../multiplayer/constants.ts";
import { subscribeSessionField } from "../../multiplayer/repository.ts";
import { JUMP_RACE_GOAL_FLOOR, jumpRaceScope, parseJumpRace, type JumpRace, type JumpRaceRecord } from "./model.ts";

/** The race lives in its own session field, next to (not inside) the slide show state. */
const JUMP_RACE_FIELD = "jumpRace";

const sessionRef = (roomId: string) => doc(db, MULTIPLAYER_COLLECTION, roomId);

export async function startJumpRace(roomId: string, showRunId: string): Promise<void> {
  const race: JumpRace = { raceId: crypto.randomUUID(), showRunId, goalFloor: JUMP_RACE_GOAL_FLOOR, startedAtMs: Date.now() };
  await updateDoc(sessionRef(roomId), { [JUMP_RACE_FIELD]: race });
}

export async function endJumpRace(roomId: string): Promise<void> {
  await updateDoc(sessionRef(roomId), { [JUMP_RACE_FIELD]: deleteField() });
}

export function subscribeJumpRace(roomId: string, onValue: (race: JumpRace | null) => void, onError: (error: Error) => void): Unsubscribe {
  return subscribeSessionField(roomId, JUMP_RACE_FIELD, parseJumpRace, (value) => onValue(value?.field ?? null), onError);
}

/** Live best floors of the race, for the teacher's line-up. */
export function observeJumpRaceRecords(
  roomId: string,
  race: JumpRace,
  playerCount: number,
  onRecords: (records: readonly JumpRaceRecord[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return observeLiveRecords(jumpRaceScope(roomId, race), Math.max(1, playerCount), (records) => {
    onRecords(records.map((record) => ({ playerId: record.playerId, floor: record.score, reachedAtMs: record.reachedAtMs })));
  }, onError);
}

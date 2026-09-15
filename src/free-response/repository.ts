import { collection, doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase/firebaseClient.ts";
import { MULTIPLAYER_COLLECTION } from "../multiplayer/constants.ts";
import { parseFreeResponse, validateFreeResponseAnswer } from "./model.ts";
import type { FreeResponse } from "./types.ts";

const responsesRef = (roomId: string, roundId: string) => collection(db, MULTIPLAYER_COLLECTION, roomId, "rounds", roundId, "freeResponses");

export function subscribeFreeResponse(roomId: string, roundId: string, playerId: string, onValue: (value: FreeResponse | null) => void, onError: (error: Error) => void) {
  return onSnapshot(doc(responsesRef(roomId, roundId), playerId), (snapshot) => {
    if (!snapshot.exists()) return onValue(null);
    const response = parseFreeResponse(snapshot.id, snapshot.data());
    if (!response) return onError(new Error("제출된 답안 형식이 올바르지 않습니다."));
    onValue(response);
  }, onError);
}

export function subscribeFreeResponses(roomId: string, roundId: string, onValue: (value: readonly FreeResponse[]) => void, onError: (error: Error) => void) {
  return onSnapshot(responsesRef(roomId, roundId), (snapshot) => {
    const responses = snapshot.docs.map((item) => parseFreeResponse(item.id, item.data()));
    if (responses.some((item) => item === null)) return onError(new Error("제출된 답안 형식이 올바르지 않습니다."));
    onValue(responses.filter((item): item is FreeResponse => item !== null));
  }, onError);
}

export async function submitFreeResponse(roomId: string, roundId: string, answer: string): Promise<void> {
  const submit = httpsCallable<{ roomId: string; roundId: string; answer: string }, unknown>(functions, "submitFreeResponse");
  await submit({ roomId, roundId, answer: validateFreeResponseAnswer(answer) });
}

export async function awardFreeResponsePoints(roomId: string, roundId: string, playerId: string): Promise<void> {
  const award = httpsCallable<{ roomId: string; roundId: string; playerId: string }, unknown>(functions, "awardFreeResponsePoints");
  await award({ roomId, roundId, playerId });
}

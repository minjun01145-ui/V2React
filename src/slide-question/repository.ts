import { collection, doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase/firebaseClient.ts";
import { MULTIPLAYER_COLLECTION } from "../multiplayer/constants.ts";
import { parseGrading, parseQuestionResponse } from "./model.ts";
import type { GradingKey, PublicQuestion, QuestionResponse } from "./model.ts";

export function subscribeQuestionResponses(roomId: string, roundId: string, playerId: string | null, onValue: (value: readonly QuestionResponse[]) => void, onError: (error: Error) => void) {
  const ref = collection(db, MULTIPLAYER_COLLECTION, roomId, "rounds", roundId, "questionResponses");
  if (playerId) return onSnapshot(doc(ref, playerId), (snapshot) => {
    const result = snapshot.exists() ? parseQuestionResponse(snapshot.data()) : null;
    if (snapshot.exists() && !result) return onError(new Error("답안 형식이 올바르지 않습니다."));
    onValue(result ? [result] : []);
  }, onError);
  return onSnapshot(ref, (snapshot) => {
    const results = snapshot.docs.map((item) => parseQuestionResponse(item.data()));
    if (results.some((item) => !item)) return onError(new Error("답안 형식이 올바르지 않습니다."));
    onValue(results.filter((item): item is QuestionResponse => item !== null));
  }, onError);
}
export function subscribeQuestionKey(roomId: string, runId: string, slideId: string, question: PublicQuestion, onValue: (value: GradingKey) => void, onError: (error: Error) => void) {
  return onSnapshot(doc(db, MULTIPLAYER_COLLECTION, roomId, "showRuns", runId, "questionKeys", slideId), (snapshot) => {
    const key = parseGrading(question, snapshot.data()?.grading);
    if (!key) return onError(new Error("정답 설정을 찾을 수 없습니다."));
    onValue(key);
  }, onError);
}
export async function submitQuestion(roomId: string, roundId: string, answer: string): Promise<void> {
  const submit = httpsCallable<{ roomId: string; roundId: string; answer: string }, unknown>(functions, "submitSlideQuestion");
  await submit({ roomId, roundId, answer });
}

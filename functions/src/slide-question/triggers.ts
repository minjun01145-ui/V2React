import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { db } from "../shared/firebase.js";
import { isRecord } from "../shared/validation.js";
import { saveSlideQuestion } from "./service.js";

export const gradeSlideQuestionResponse = onDocumentCreated({
  document: "multiplayerSessions/{roomId}/rounds/{roundId}/questionResponses/{uid}",
  region: "asia-northeast3", retry: true, timeoutSeconds: 180, maxInstances: 6,
}, async (event) => {
  const created: unknown = event.data?.data();
  // The worker can be deployed ahead of the producer without touching older submissions.
  if (!isRecord(created) || created.correct !== null || !isRecord(created.gradingContext)) return;
  const { roomId, roundId, uid } = event.params;
  const ref = db.collection("multiplayerSessions").doc(roomId).collection("rounds").doc(roundId).collection("questionResponses").doc(uid);
  const current: unknown = (await ref.get()).data();
  if (!isRecord(current) || current.correct !== null || typeof current.answer !== "string") return;
  await saveSlideQuestion(uid, { roomId, roundId, answer: current.answer });
  const result: unknown = (await ref.get()).data();
  // Retry delivery if another live attempt owns the lease; finished results are idempotent.
  if (isRecord(result) && result.correct === null) throw new Error("Slide question grading is still pending.");
});

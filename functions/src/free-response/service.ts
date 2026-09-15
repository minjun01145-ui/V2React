import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { db } from "../shared/firebase.js";
import { isRecord } from "../shared/validation.js";
import { assertAwardOpen, assertSubmissionOpen, freeResponseProgress } from "./model.js";
import { parseFreeResponseRound } from "./validation.js";

interface Scope { readonly roomId: string; readonly roundId: string }

export async function saveFreeResponse(uid: string, input: Scope & { readonly answer: string }): Promise<void> {
  const sessionRef = db.collection("multiplayerSessions").doc(input.roomId);
  const roundRef = sessionRef.collection("rounds").doc(input.roundId);
  const responseRef = roundRef.collection("freeResponses").doc(uid);
  const progressRef = roundRef.collection("progress").doc(uid);
  await db.runTransaction(async (tx) => {
    const [session, participant, response, progress] = await Promise.all([
      tx.get(sessionRef), tx.get(roundRef.collection("participants").doc(uid)), tx.get(responseRef), tx.get(progressRef),
    ]);
    const round = parseFreeResponseRound(session.exists ? session.data() : null, input.roundId);
    const now = Date.now();
    assertSubmissionOpen(round, now);
    const identity: unknown = participant.exists ? participant.data() : null;
    if (!isRecord(identity) || identity.playerId !== uid || typeof identity.displayName !== "string" || typeof identity.studentNumber !== "string") {
      throw new HttpsError("permission-denied", "이 라운드의 참가자가 아닙니다.");
    }
    const previous: unknown = response.exists ? response.data() : null;
    const submittedAtMs = isRecord(previous) && typeof previous.submittedAtMs === "number" ? previous.submittedAtMs : now;
    const storedProgress: unknown = progress.exists ? progress.data() : null;
    const revision = isRecord(storedProgress) && typeof storedProgress.revision === "number" ? storedProgress.revision : 0;
    tx.set(responseRef, {
      playerId: uid, answer: input.answer, score: 0, awardedBy: null, awardedAtMs: null,
      submittedAtMs, updatedAtMs: now, updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(progressRef, { ...freeResponseProgress(uid, identity.displayName, 0, submittedAtMs, revision + 1, now), updatedAt: FieldValue.serverTimestamp() });
  });
}

export async function awardFreeResponse(adminUid: string, input: Scope & { readonly playerId: string }): Promise<void> {
  const sessionRef = db.collection("multiplayerSessions").doc(input.roomId);
  const roundRef = sessionRef.collection("rounds").doc(input.roundId);
  const responseRef = roundRef.collection("freeResponses").doc(input.playerId);
  const progressRef = roundRef.collection("progress").doc(input.playerId);
  await db.runTransaction(async (tx) => {
    const [session, response, progress] = await Promise.all([tx.get(sessionRef), tx.get(responseRef), tx.get(progressRef)]);
    assertAwardOpen(parseFreeResponseRound(session.exists ? session.data() : null, input.roundId));
    const data: unknown = response.exists ? response.data() : null;
    const storedProgress: unknown = progress.exists ? progress.data() : null;
    if (!isRecord(data) || data.playerId !== input.playerId || typeof data.answer !== "string" || !data.answer.trim()
      || typeof data.submittedAtMs !== "number" || !isRecord(storedProgress) || typeof storedProgress.displayName !== "string"
      || typeof storedProgress.revision !== "number") throw new HttpsError("failed-precondition", "제출된 답안을 찾을 수 없습니다.");
    if (data.score === 100) return;
    const now = Date.now();
    tx.update(responseRef, { score: 100, awardedBy: adminUid, awardedAtMs: now, updatedAtMs: now, updatedAt: FieldValue.serverTimestamp() });
    tx.set(progressRef, { ...freeResponseProgress(input.playerId, storedProgress.displayName, 100, data.submittedAtMs, storedProgress.revision + 1, now), updatedAt: FieldValue.serverTimestamp() });
  });
}

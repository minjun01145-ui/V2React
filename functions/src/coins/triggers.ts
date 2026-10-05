import { onDocumentCreated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { db } from "../shared/firebase.js";
import { effectiveTenantId } from "../shared/tenant.js";
import { isRecord } from "../shared/validation.js";
import { grantGameParticipationCoins } from "./service.js";

export const awardClassroomGameCoins = onDocumentWritten({
  region: "asia-northeast3", document: "multiplayerSessions/{roomId}",
}, async (event) => {
  const after: unknown = event.data?.after.data();
  const before: unknown = event.data?.before.data();
  if (!isRecord(after) || after.status !== "playing" || typeof after.roundId !== "string" || !after.roundId
    || isRecord(before) && before.status === "playing" && before.roundId === after.roundId) return;
  const tenantId = effectiveTenantId(after.tenantId);
  const participants = await db.collection("multiplayerSessions").doc(event.params.roomId).collection("rounds").doc(after.roundId).collection("participants").get();
  for (let index = 0; index < participants.docs.length; index += 10) {
    await Promise.all(participants.docs.slice(index, index + 10).map((participant) => grantGameParticipationCoins(tenantId, event.params.roomId, after.roundId as string, participant.data())));
  }
});

// Joining an already running game is also participation. The same receipt deduplicates
// this event with the round-start event, regardless of delivery order.
export const awardJoinedGameCoins = onDocumentCreated({
  region: "asia-northeast3", document: "multiplayerSessions/{roomId}/rounds/{roundId}/participants/{uid}",
}, async (event) => {
  const session = await db.collection("multiplayerSessions").doc(event.params.roomId).get();
  const data: unknown = session.data();
  if (!isRecord(data) || data.status !== "playing" || data.roundId !== event.params.roundId) return;
  await grantGameParticipationCoins(effectiveTenantId(data.tenantId), event.params.roomId, event.params.roundId, event.data?.data());
});

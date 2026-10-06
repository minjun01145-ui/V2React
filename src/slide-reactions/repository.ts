import { getDatabase, onValue, ref, serverTimestamp, set, type Unsubscribe } from "firebase/database";
import { firebaseApp } from "../firebase/firebaseClient.ts";
import { livePathSegment } from "../live-world/paths.ts";
import { currentTenantConfig } from "../tenant/config.ts";
import { newReactions, parseStoredReaction, type SlideReaction } from "./model.ts";

/** Reactions are fire-and-forget: only each student's latest one is kept, and nothing is saved elsewhere. */
function roomPath(roomId: string): string {
  return `slideReactions/v1/${livePathSegment(currentTenantConfig().id, "tenantId")}/${livePathSegment(roomId, "roomId")}`;
}

export async function sendSlideReaction(roomId: string, playerId: string, reaction: number): Promise<void> {
  await set(ref(getDatabase(firebaseApp), `${roomPath(roomId)}/${livePathSegment(playerId, "playerId")}`), { e: reaction, t: serverTimestamp() });
}

/** Calls `onReaction` for every reaction sent after subscribing. */
export function subscribeSlideReactions(roomId: string, onReaction: (reaction: SlideReaction) => void, onError: (error: Error) => void): Unsubscribe {
  let seen: Map<string, number> | null = null;
  return onValue(ref(getDatabase(firebaseApp), roomPath(roomId)), (snapshot) => {
    const raw: unknown = snapshot.val();
    const current = typeof raw === "object" && raw !== null
      ? Object.entries(raw).flatMap(([playerId, value]) => parseStoredReaction(playerId, value) ?? [])
      : [];
    for (const reaction of newReactions(seen, current)) onReaction(reaction);
    seen = new Map(current.map((item) => [item.playerId, item.sentAtMs]));
  }, onError);
}

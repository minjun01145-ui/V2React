import { doc, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from "firebase/firestore";
import { db } from "../firebase/firebaseClient.ts";
import { MULTIPLAYER_COLLECTION } from "../multiplayer/constants.ts";
import { parseNotice, validateNoticeText, type ClassroomNotice } from "./model.ts";

/** One notice per room, kept across sessions; only the teacher writes it (Firestore rules). */
const noticeRef = (roomId: string) => doc(db, MULTIPLAYER_COLLECTION, roomId, "notice", "current");

export async function publishNotice(roomId: string, text: string): Promise<void> {
  await setDoc(noticeRef(roomId), { text: validateNoticeText(text), updatedAt: serverTimestamp(), updatedAtMs: Date.now() });
}

export function subscribeNotice(roomId: string, onValue: (notice: ClassroomNotice | null) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(noticeRef(roomId), (snapshot) => onValue(snapshot.exists() ? parseNotice(snapshot.data()) : null), onError);
}

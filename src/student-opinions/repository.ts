import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, type Unsubscribe } from "firebase/firestore";
import { db } from "../firebase/firebaseClient.ts";
import { MULTIPLAYER_COLLECTION } from "../multiplayer/constants.ts";
import { parseOpinion, validateOpinionText, type OpinionAuthor, type StudentOpinion } from "./model.ts";

/** Students may only add their own opinion; only the room's teacher may read or delete (Firestore rules). */
const opinionsRef = (roomId: string) => collection(db, MULTIPLAYER_COLLECTION, roomId, "opinions");

export async function submitOpinion(roomId: string, author: OpinionAuthor, text: string): Promise<void> {
  await addDoc(opinionsRef(roomId), {
    text: validateOpinionText(text),
    playerId: author.playerId,
    studentNumber: author.studentNumber,
    displayName: author.displayName,
    createdAt: serverTimestamp(),
    createdAtMs: Date.now(),
  });
}

/** Newest first, text and time only. */
export function subscribeOpinions(roomId: string, onValue: (opinions: readonly StudentOpinion[]) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(query(opinionsRef(roomId), orderBy("createdAtMs", "desc")), (snapshot) => {
    onValue(snapshot.docs.flatMap((item) => parseOpinion(item.id, item.data()) ?? []));
  }, onError);
}

export async function deleteOpinion(roomId: string, opinionId: string): Promise<void> {
  await deleteDoc(doc(opinionsRef(roomId), opinionId));
}

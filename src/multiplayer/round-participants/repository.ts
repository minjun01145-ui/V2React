import { collection, doc, onSnapshot, type DocumentReference, type Unsubscribe } from "firebase/firestore";
import { db } from "../../firebase/firebaseClient.ts";
import { MULTIPLAYER_COLLECTION } from "../constants.ts";
import { parseRoundParticipant, type RoundParticipant } from "./model.ts";

export function roundParticipantsRef(roomId: string, roundId: string) {
  return collection(db, MULTIPLAYER_COLLECTION, roomId, "rounds", roundId, "participants");
}

export function roundParticipantRef(roomId: string, roundId: string, playerId: string): DocumentReference {
  return doc(roundParticipantsRef(roomId, roundId), playerId);
}

export function subscribeRoundParticipants(
  roomId: string,
  roundId: string,
  onValue: (participants: RoundParticipant[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(roundParticipantsRef(roomId, roundId), (snapshot) => {
    const participants = snapshot.docs
      .map((participantDoc) => parseRoundParticipant(participantDoc.id, participantDoc.data()))
      .filter((participant): participant is RoundParticipant => participant !== null)
      .sort((first, second) => first.studentNumber.localeCompare(second.studentNumber, "ko-KR", { numeric: true }));
    onValue(participants);
  }, onError);
}

export function subscribeRoundParticipant(
  roomId: string,
  roundId: string,
  playerId: string,
  onValue: (participant: RoundParticipant | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(roundParticipantRef(roomId, roundId, playerId), (snapshot) => {
    onValue(snapshot.exists() ? parseRoundParticipant(snapshot.id, snapshot.data()) : null);
  }, onError);
}

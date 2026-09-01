import { collection, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "../../firebase/firebaseClient.ts";
import { MULTIPLAYER_COLLECTION } from "../constants.ts";
import { parseRoundReadiness, type RoundReadiness } from "./model.ts";

export function subscribeRoundReadiness(
  roomId: string,
  roundId: string,
  onValue: (value: RoundReadiness[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const ref = collection(db, MULTIPLAYER_COLLECTION, roomId, "rounds", roundId, "readiness");
  return onSnapshot(ref, (snapshot) => {
    onValue(snapshot.docs
      .map((item) => parseRoundReadiness(item.id, item.data()))
      .filter((item): item is RoundReadiness => item !== null));
  }, onError);
}

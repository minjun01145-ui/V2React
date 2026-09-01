import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../../firebase/firebaseClient.ts";
import { isCharacterId } from "../../characters/catalog.ts";
import { EMPTY_STUDENT_COSMETICS, type StudentCosmetics } from "./types.ts";

const cosmeticsDocument = (accountId: string) => doc(db, "studentGameData", accountId, "cosmetics", "profile");

function parseCosmetics(data: DocumentData | undefined): StudentCosmetics {
  if (!data) return EMPTY_STUDENT_COSMETICS;
  return {
    equippedCharacterId: isCharacterId(data.equippedCharacterId) ? data.equippedCharacterId : null,
  };
}

export function subscribeStudentCosmetics(
  accountId: string,
  onValue: (cosmetics: StudentCosmetics) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    cosmeticsDocument(accountId),
    (snapshot) => onValue(parseCosmetics(snapshot.data())),
    onError,
  );
}

export async function equipCharacter(accountId: string, characterId: string): Promise<void> {
  if (!isCharacterId(characterId)) throw new Error("장착할 수 없는 캐릭터입니다.");
  await setDoc(cosmeticsDocument(accountId), {
    equippedCharacterId: characterId,
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
  });
}

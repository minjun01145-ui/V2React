import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebaseClient.ts";
import type { NicknameGrade } from "../../multiplayer/types.ts";
import { dailyRandomNicknameDocumentId, parseDailyRandomNickname, resolveDailyRandomNickname, type DailyRandomNickname } from "./model.ts";

export async function claimDailyRandomNickname(
  accountId: string,
  roomId: string,
  rollDay: string,
  candidate: { readonly nickname: string; readonly grade: NicknameGrade },
): Promise<DailyRandomNickname> {
  if (!accountId) throw new Error("랜덤 닉네임 저장 경로가 올바르지 않습니다.");
  const rollRef = doc(db, "studentGameData", accountId, "randomNicknames", dailyRandomNicknameDocumentId(roomId, rollDay));
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(rollRef);
    if (snapshot.exists()) {
      const stored = parseDailyRandomNickname(snapshot.data(), rollDay);
      if (!stored) throw new Error("저장된 랜덤 닉네임 형식이 올바르지 않습니다.");
      return stored;
    }

    const selected = resolveDailyRandomNickname(null, candidate, rollDay);
    transaction.set(rollRef, {
      nickname: selected.nickname,
      nicknameGrade: selected.nicknameGrade,
      rollDay: selected.rollDay,
      createdAt: serverTimestamp(),
      createdAtMs: Date.now(),
    });
    return selected;
  });
}

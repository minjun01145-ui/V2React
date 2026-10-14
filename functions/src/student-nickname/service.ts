import { FieldValue } from "firebase-admin/firestore";
import { db } from "../shared/firebase.js";
import { isRecord } from "../shared/validation.js";
import {
  koreanDayKey,
  parseDailyRandomNickname,
  randomNicknameDocumentId,
  type DailyRandomNickname,
} from "./model.js";
import { pickNicknameOfGrade, pickRandomNickname } from "./pool.js";

interface EnsureInput {
  readonly accountId: string;
  readonly roomId: string;
  readonly uid: string;
  readonly now?: number;
}

function nicknameOf(data: unknown): string {
  if (!isRecord(data) || typeof data.nickname !== "string") return "";
  return data.nickname.trim();
}

function rollDocument(roll: DailyRandomNickname, now: number): Record<string, unknown> {
  return {
    nickname: roll.nickname,
    nicknameGrade: roll.nicknameGrade,
    rollDay: roll.rollDay,
    createdAt: FieldValue.serverTimestamp(),
    createdAtMs: now,
  };
}

/**
 * Today's random nickname for a student, creating the roll the first time it is asked for.
 *
 * The roll is stored under the student's server-owned account document and only this callable
 * writes it, so reloading, switching devices or writing Firestore directly cannot produce a
 * second roll in the same Korea-time day. The name and its grade are drawn on the server, so a
 * browser can never claim a higher grade. A stored roll is replaced only when another player in
 * the room already wears that exact name, which keeps the lobby unique without a self-service
 * reroll.
 */
export async function ensureDailyRandomNickname({ accountId, roomId, uid, now = Date.now() }: EnsureInput): Promise<DailyRandomNickname> {
  const rollDay = koreanDayKey(now);
  const rollRef = db.collection("studentGameData").doc(accountId).collection("randomNicknames").doc(randomNicknameDocumentId(roomId, rollDay));
  const playersRef = db.collection("multiplayerSessions").doc(roomId).collection("players");

  return db.runTransaction(async (transaction) => {
    const [rollSnapshot, playersSnapshot] = await Promise.all([transaction.get(rollRef), transaction.get(playersRef)]);
    const usedNicknames = new Set(playersSnapshot.docs
      .filter((item) => item.id !== uid)
      .map((item) => nicknameOf(item.data()))
      .filter(Boolean));

    const stored = parseDailyRandomNickname(rollSnapshot.exists ? rollSnapshot.data() : null, rollDay);
    if (stored) {
      if (!usedNicknames.has(stored.nickname)) return stored;
      // Break the duplicate with another name of the same grade so a clash cannot be farmed.
      const replacement = pickNicknameOfGrade(stored.nicknameGrade, usedNicknames);
      if (!replacement) return stored;
      const roll: DailyRandomNickname = { nickname: replacement, nicknameGrade: stored.nicknameGrade, rollDay };
      transaction.set(rollRef, rollDocument(roll, now));
      return roll;
    }

    const candidate = pickRandomNickname(usedNicknames);
    const roll: DailyRandomNickname = { nickname: candidate.nickname, nicknameGrade: candidate.grade, rollDay };
    transaction.set(rollRef, rollDocument(roll, now));
    return roll;
  });
}

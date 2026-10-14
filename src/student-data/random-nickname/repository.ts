import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/firebaseClient.ts";
import { parseDailyRandomNickname, type DailyRandomNickname } from "./model.ts";

/**
 * Asks the server for today's one graded random nickname. The server draws the name and grade
 * and stores the roll under a document only it can write, so a reload, another device or a
 * direct Firestore write cannot reroll before the next Korea-time day.
 */
export async function ensureDailyRandomNickname(roomId: string): Promise<DailyRandomNickname> {
  const call = httpsCallable<{ readonly roomId: string }, unknown>(functions, "ensureDailyStudentNickname");
  const { data } = await call({ roomId });
  const roll = parseDailyRandomNickname(data);
  if (!roll) throw new Error("랜덤 닉네임을 확인하지 못했습니다.");
  return roll;
}

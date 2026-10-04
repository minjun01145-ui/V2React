import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/firebaseClient.ts";

export interface DateStudentPick {
  readonly playerId: string;
  readonly studentNumber: string;
  readonly date: string;
  readonly title: string;
  readonly calculation: readonly string[];
}

export async function requestDateStudentPick(roomId: string): Promise<DateStudentPick> {
  const call = httpsCallable<{ roomId: string }, unknown>(functions, "pickSlideShowStudent", { timeout: 120_000 });
  const { data } = await call({ roomId });
  if (typeof data !== "object" || data === null) throw new Error("뽑기 결과를 확인하지 못했습니다.");
  const value = data as Record<string, unknown>;
  if (typeof value.playerId !== "string" || !value.playerId
    || typeof value.studentNumber !== "string" || !/^[0-9]{1,12}$/.test(value.studentNumber)
    || typeof value.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)
    || typeof value.title !== "string" || value.title.length > 100
    || !Array.isArray(value.calculation) || value.calculation.length > 8
    || !value.calculation.every((line: unknown) => typeof line === "string" && line.length <= 300)) {
    throw new Error("뽑기 결과를 확인하지 못했습니다.");
  }
  return { playerId: value.playerId, studentNumber: value.studentNumber, date: value.date, title: value.title, calculation: value.calculation as string[] };
}

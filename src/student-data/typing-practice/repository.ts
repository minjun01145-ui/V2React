import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/firebaseClient.ts";

export interface PracticeRecord {
  readonly nickname: string;
  readonly classroom: string;
  readonly averageCpm: number;
  readonly bestCpm: number;
  readonly completedAt: number;
}
export interface PracticeCompletion {
  readonly month: string;
  readonly result: PracticeRecord;
  readonly records: readonly PracticeRecord[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseRecord(value: unknown): PracticeRecord {
  if (!record(value) || typeof value.nickname !== "string" || typeof value.classroom !== "string"
    || ![value.averageCpm, value.bestCpm, value.completedAt].every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0)) {
    throw new Error("순위 기록 형식이 올바르지 않습니다.");
  }
  return value as unknown as PracticeRecord;
}

export async function savePracticeCompletion(roomId: string, runId: string, speed: { readonly averageCpm: number; readonly bestCpm: number }, questionCount: number): Promise<PracticeCompletion> {
  const call = httpsCallable<unknown, unknown>(functions, "completeTypingPractice");
  const { data } = await call({ roomId, runId, averageCpm: speed.averageCpm, bestCpm: speed.bestCpm, questionCount, completedCount: questionCount });
  if (!record(data) || typeof data.month !== "string" || !/^\d{4}-\d{2}$/.test(data.month) || !Array.isArray(data.records) || data.records.length > 10) {
    throw new Error("월간 순위를 불러오지 못했습니다.");
  }
  return { month: data.month, result: parseRecord(data.result), records: data.records.map(parseRecord) };
}

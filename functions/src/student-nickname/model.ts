/**
 * Daily random nickname roll. The server owns both the roll and the day: a student gets one
 * roll per Korea-time (Asia/Seoul) calendar day, and the roll is stored under a document the
 * browser cannot write, so reloading, switching devices or writing Firestore directly cannot
 * reroll it.
 */

export const NICKNAME_GRADES = ["C", "B", "A", "S"] as const;
export type NicknameGrade = (typeof NICKNAME_GRADES)[number];

const DAY_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const ROOM_ID_PATTERN = /^[\p{L}\p{N}._-]{1,64}$/u;

// Korea has a fixed offset (no daylight saving), so the local day is a plain UTC shift.
const KOREA_OFFSET_MS = 9 * 3_600_000;

/** Calendar day in Asia/Seoul for a server time, as YYYY-MM-DD. */
export function koreanDayKey(now: number = Date.now()): string {
  return new Date(now + KOREA_OFFSET_MS).toISOString().slice(0, 10);
}

export function isNicknameGrade(value: unknown): value is NicknameGrade {
  return typeof value === "string" && (NICKNAME_GRADES as readonly string[]).includes(value);
}

export interface DailyRandomNickname {
  readonly nickname: string;
  readonly nicknameGrade: NicknameGrade;
  readonly rollDay: string;
}

export function randomNicknameDocumentId(roomId: string, rollDay: string): string {
  if (!ROOM_ID_PATTERN.test(roomId) || !DAY_PATTERN.test(rollDay)) {
    throw new Error("랜덤 닉네임 저장 경로가 올바르지 않습니다.");
  }
  return `${roomId}:${rollDay}`;
}

/** Reads a stored roll, rejecting anything that is not this exact day's roll. */
export function parseDailyRandomNickname(value: unknown, expectedDay: string): DailyRandomNickname | null {
  if (typeof value !== "object" || value === null || Array.isArray(value) || !DAY_PATTERN.test(expectedDay)) return null;
  const record = value as Readonly<Record<string, unknown>>;
  const nickname = typeof record.nickname === "string" ? record.nickname.trim() : "";
  if (record.rollDay !== expectedDay
    || nickname.length < 2 || nickname.length > 12
    || !isNicknameGrade(record.nicknameGrade)) return null;
  return { nickname, nicknameGrade: record.nicknameGrade, rollDay: expectedDay };
}

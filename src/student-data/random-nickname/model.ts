import type { NicknameGrade } from "../../multiplayer/types.ts";

export interface DailyRandomNickname {
  readonly nickname: string;
  readonly nicknameGrade: NicknameGrade;
  readonly rollDay: string;
}

const ROLL_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function dailyRandomNicknameDay(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string): string => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function parseDailyRandomNickname(value: unknown, expectedDay: string): DailyRandomNickname | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Readonly<Record<string, unknown>>;
  const nickname = typeof record.nickname === "string" ? record.nickname.trim() : "";
  const nicknameGrade = record.nicknameGrade;
  if (!ROLL_DAY_PATTERN.test(expectedDay)
    || record.rollDay !== expectedDay
    || nickname.length < 2 || nickname.length > 12
    || (nicknameGrade !== "C" && nicknameGrade !== "B" && nicknameGrade !== "A" && nicknameGrade !== "S")) return null;
  return { nickname, nicknameGrade, rollDay: expectedDay };
}

export function dailyRandomNicknameDocumentId(roomId: string, rollDay: string): string {
  if (!roomId || roomId.includes("/") || !ROLL_DAY_PATTERN.test(rollDay)) throw new Error("랜덤 닉네임 저장 경로가 올바르지 않습니다.");
  return `${roomId}:${rollDay}`;
}

export function resolveDailyRandomNickname(
  stored: unknown,
  candidate: { readonly nickname: string; readonly grade: NicknameGrade },
  rollDay: string,
): DailyRandomNickname {
  const existing = parseDailyRandomNickname(stored, rollDay);
  if (existing) return existing;
  const next = parseDailyRandomNickname({
    nickname: candidate.nickname,
    nicknameGrade: candidate.grade,
    rollDay,
  }, rollDay);
  if (!next) throw new Error("랜덤 닉네임 형식이 올바르지 않습니다.");
  return next;
}

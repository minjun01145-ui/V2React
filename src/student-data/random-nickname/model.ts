import type { NicknameGrade } from "../../multiplayer/types.ts";

export interface DailyRandomNickname {
  readonly nickname: string;
  readonly nicknameGrade: NicknameGrade;
  readonly rollDay: string;
}

const ROLL_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isNicknameGrade(value: unknown): value is NicknameGrade {
  return value === "C" || value === "B" || value === "A" || value === "S";
}

/** Validates the graded roll returned by the server nickname callable. */
export function parseDailyRandomNickname(value: unknown): DailyRandomNickname | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Readonly<Record<string, unknown>>;
  const nickname = typeof record.nickname === "string" ? record.nickname.trim() : "";
  const rollDay = typeof record.rollDay === "string" ? record.rollDay : "";
  if (nickname.length < 2 || nickname.length > 12 || !ROLL_DAY_PATTERN.test(rollDay) || !isNicknameGrade(record.nicknameGrade)) return null;
  return { nickname, nicknameGrade: record.nicknameGrade, rollDay };
}

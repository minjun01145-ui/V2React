/** The teacher's notice (homework, progress …) shown at the top of the student lobby. */
export const MAX_NOTICE_LENGTH = 2_000;

export interface ClassroomNotice {
  readonly text: string;
  readonly updatedAtMs: number;
}

export function validateNoticeText(value: string): string {
  const text = value.trim();
  if (text.length > MAX_NOTICE_LENGTH) throw new Error(`공지는 ${MAX_NOTICE_LENGTH.toLocaleString("ko-KR")}자 이하로 입력해 주세요.`);
  return text;
}

export function parseNotice(value: unknown): ClassroomNotice | null {
  if (typeof value !== "object" || value === null) return null;
  const { text, updatedAtMs } = value as Record<string, unknown>;
  if (typeof text !== "string" || text.length > MAX_NOTICE_LENGTH || typeof updatedAtMs !== "number") return null;
  return { text, updatedAtMs };
}

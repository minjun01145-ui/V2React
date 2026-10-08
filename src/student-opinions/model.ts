/**
 * Opinions students leave from the lobby. The stored document keeps who wrote it (for the
 * administrator, in the Firebase console, when it is truly needed), but the app only ever
 * reads the text and time: the teacher's screen never shows the author.
 */
export const MAX_OPINION_LENGTH = 1_000;

export interface StudentOpinion {
  readonly id: string;
  readonly text: string;
  readonly createdAtMs: number;
}

/** The author fields written with an opinion; they must match the student's sign-in (Firestore rules). */
export interface OpinionAuthor {
  readonly playerId: string;
  readonly studentNumber: string;
  readonly displayName: string;
}

export function validateOpinionText(value: string): string {
  const text = value.trim();
  if (!text || text.length > MAX_OPINION_LENGTH) throw new Error(`의견은 1~${MAX_OPINION_LENGTH.toLocaleString("ko-KR")}자로 입력해 주세요.`);
  return text;
}

/** Reads only what the teacher may see; author fields are deliberately left out. */
export function parseOpinion(id: string, value: unknown): StudentOpinion | null {
  if (typeof value !== "object" || value === null) return null;
  const { text, createdAtMs } = value as Record<string, unknown>;
  if (typeof text !== "string" || !text.trim() || typeof createdAtMs !== "number") return null;
  return { id, text, createdAtMs };
}

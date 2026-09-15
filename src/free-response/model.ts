import { FREE_RESPONSE_MAX_LENGTH, type FreeResponse, type FreeResponseParticipant, type FreeResponseRow } from "./types.ts";

export function validateFreeResponseAnswer(value: string): string {
  const answer = value.trim();
  if (!answer || answer.length > FREE_RESPONSE_MAX_LENGTH) throw new Error(`답안은 1~${FREE_RESPONSE_MAX_LENGTH}자로 입력해 주세요.`);
  return answer;
}

export function parseFreeResponse(playerId: string, value: unknown): FreeResponse | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (data.playerId !== playerId || typeof data.answer !== "string" || !data.answer.trim() || data.answer.length > FREE_RESPONSE_MAX_LENGTH
    || (data.score !== 0 && data.score !== 100) || typeof data.submittedAtMs !== "number" || !Number.isFinite(data.submittedAtMs)
    || typeof data.updatedAtMs !== "number" || !Number.isFinite(data.updatedAtMs)) return null;
  return { playerId, answer: data.answer, score: data.score, submittedAtMs: data.submittedAtMs, updatedAtMs: data.updatedAtMs };
}

export function freeResponseRows(participants: readonly FreeResponseParticipant[], responses: readonly FreeResponse[]): readonly FreeResponseRow[] {
  const byPlayer = new Map(responses.map((response) => [response.playerId, response]));
  return participants.map((participant) => ({ ...participant, response: byPlayer.get(participant.playerId) ?? null }));
}

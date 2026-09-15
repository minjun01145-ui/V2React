export const FREE_RESPONSE_MAX_LENGTH = 2000;
export const FREE_RESPONSE_AWARD_POINTS = 100;

export interface FreeResponse {
  readonly playerId: string;
  readonly answer: string;
  readonly score: 0 | 100;
  readonly submittedAtMs: number;
  readonly updatedAtMs: number;
}

export interface FreeResponseParticipant {
  readonly playerId: string;
  readonly studentNumber: string;
  readonly displayName: string;
  readonly nickname: string | null;
}

export interface FreeResponseRow extends FreeResponseParticipant {
  readonly response: FreeResponse | null;
}

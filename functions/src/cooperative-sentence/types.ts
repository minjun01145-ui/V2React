export interface CooperativeInput { readonly roomId: string; readonly roundId: string; }
export interface CooperativeSubmitInput extends CooperativeInput { readonly submissionId: string; readonly generation: number; readonly questionId: string; readonly tokenIds: readonly string[]; }

export interface MemberProfile {
  readonly playerId: string;
  readonly nickname: string;
  readonly avatar: unknown;
}

export interface StoredTeam {
  readonly name: string;
  readonly memberIds: readonly string[];
  readonly memberProfiles: readonly MemberProfile[];
  readonly memberCount: number;
  readonly status: "active" | "completed" | "eliminated";
  readonly hearts: number;
  readonly currentQuestionIndex: number;
  readonly questionCount: number;
  readonly turnMemberIndex: number;
  readonly generation: number;
}

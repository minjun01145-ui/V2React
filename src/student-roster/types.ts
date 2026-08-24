export interface StudentRosterEntry {
  readonly studentNumber: string;
  readonly displayName: string;
  readonly active: boolean;
  readonly pinConfigured: boolean;
  readonly updatedAtMs: number;
}

export interface StudentRosterInput {
  readonly studentNumber: string;
  readonly name: string;
  readonly active: boolean;
}

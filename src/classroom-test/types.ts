export interface MultiplayerTestStudentCredential {
  readonly slot: number;
  readonly studentNumber: string;
  readonly displayName: string;
  readonly joinSecret: string;
}

export interface JoinedMultiplayerTestStudent {
  readonly slot: number;
  readonly uid: string;
  readonly studentNumber: string;
  readonly displayName: string;
}

export interface MultiplayerTestSession {
  readonly runId: string;
  readonly roomId: string;
  readonly expiresAtMs: number;
  readonly students: readonly MultiplayerTestStudentCredential[];
}

export type TestStudentClientStatus = "loading" | "connecting" | "connected" | "error" | "left";

export interface TestStudentClientState {
  readonly slot: number;
  readonly status: TestStudentClientStatus;
  readonly message: string;
}

export interface MultiplayerTestStudentDefinition {
  readonly slot: number;
  readonly studentNumber: string;
  readonly displayName: string;
}

export interface MultiplayerTestStudentCredential extends MultiplayerTestStudentDefinition {
  readonly joinSecret: string;
}

export interface JoinedMultiplayerTestStudent extends MultiplayerTestStudentDefinition {
  readonly uid: string;
}

export interface MultiplayerTestSessionResult {
  readonly runId: string;
  readonly roomId: string;
  readonly expiresAtMs: number;
  readonly students: readonly MultiplayerTestStudentCredential[];
}

export const MULTIPLAYER_TEST_STUDENTS: readonly MultiplayerTestStudentDefinition[] = Object.freeze([
  Object.freeze({ slot: 1, studentNumber: "99001", displayName: "테스트 학생 1" }),
  Object.freeze({ slot: 2, studentNumber: "99002", displayName: "테스트 학생 2" }),
  Object.freeze({ slot: 3, studentNumber: "99003", displayName: "테스트 학생 3" }),
]);

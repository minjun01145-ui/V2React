import { collection, doc, onSnapshot, runTransaction, serverTimestamp, setDoc, type Unsubscribe } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase/firebaseClient.ts";
import { MULTIPLAYER_COLLECTION, SESSION_STATUS } from "../multiplayer/constants.ts";
import { parseStudentQuestionSubmission } from "./codec.ts";
import { STUDENT_QUESTION_ACTIVITY_KIND, type StudentQuestionConfig, type StudentQuestionDraft, type StudentQuestionSubmission } from "./types.ts";
import { parseStudentQuestionConfig, validateStudentQuestions } from "./validation.ts";

const sessionRef = (roomId: string) => doc(db, MULTIPLAYER_COLLECTION, roomId);
const runRef = (roomId: string, runId: string) => doc(db, MULTIPLAYER_COLLECTION, roomId, "studentQuestionRuns", runId);
const submissionRef = (roomId: string, runId: string, playerId: string) => doc(db, MULTIPLAYER_COLLECTION, roomId, "studentQuestionRuns", runId, "submissions", playerId);

export async function startStudentQuestionActivity(roomId: string, configValue: StudentQuestionConfig, expectedPlayerIdsValue: readonly string[]): Promise<string> {
  const config = parseStudentQuestionConfig(configValue);
  const expectedPlayerIds = [...new Set(expectedPlayerIdsValue.filter(Boolean))];
  if (expectedPlayerIds.length === 0) throw new Error("질문 만들기를 시작할 학생이 없습니다.");
  const runId = crypto.randomUUID();
  const now = Date.now();
  await runTransaction(db, async (tx) => {
    const session = await tx.get(sessionRef(roomId));
    const data: unknown = session.exists() ? session.data() : null;
    if (typeof data !== "object" || data === null || Array.isArray(data)) throw new Error("수업 세션을 찾을 수 없습니다.");
    const current = data as Record<string, unknown>;
    if (current.status !== SESSION_STATUS.WAITING || current.classroomActivity) throw new Error("다른 게임이나 질문 만들기가 진행 중입니다.");
    const activity = { kind: STUDENT_QUESTION_ACTIVITY_KIND, runId, phase: "active", config, expectedPlayerIds, resultSetId: null } as const;
    tx.set(runRef(roomId, runId), { ...activity, startedAt: serverTimestamp(), startedAtMs: now });
    tx.set(sessionRef(roomId), { classroomActivity: activity, updatedAt: serverTimestamp(), updatedAtMs: now }, { merge: true });
  });
  return runId;
}

export function subscribeStudentQuestionSubmission(roomId: string, runId: string, playerId: string, onValue: (value: StudentQuestionSubmission | null) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(submissionRef(roomId, runId, playerId), (snapshot) => onValue(snapshot.exists() ? parseStudentQuestionSubmission(snapshot.id, snapshot.data()) : null), onError);
}

export function subscribeStudentQuestionSubmissions(roomId: string, runId: string, onValue: (value: readonly StudentQuestionSubmission[]) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(collection(db, MULTIPLAYER_COLLECTION, roomId, "studentQuestionRuns", runId, "submissions"), (snapshot) => {
    onValue(snapshot.docs.flatMap((item) => {
      const parsed = parseStudentQuestionSubmission(item.id, item.data());
      return parsed ? [parsed] : [];
    }));
  }, onError);
}

export async function submitStudentQuestions(roomId: string, runId: string, playerId: string, config: StudentQuestionConfig, questionsValue: readonly StudentQuestionDraft[]): Promise<void> {
  const questions = validateStudentQuestions(questionsValue, config);
  await setDoc(submissionRef(roomId, runId, playerId), {
    playerId,
    questions,
    submitted: true,
    submittedAt: serverTimestamp(),
    submittedAtMs: Date.now(),
  });
  const finalize = httpsCallable<{ roomId: string; runId: string; force: boolean }, unknown>(functions, "finalizeStudentQuestionRun");
  await finalize({ roomId, runId, force: false });
}

export async function finalizeStudentQuestionActivity(roomId: string, runId: string): Promise<void> {
  const callable = httpsCallable<{ roomId: string; runId: string; force: boolean }, unknown>(functions, "finalizeStudentQuestionRun");
  await callable({ roomId, runId, force: true });
}

export interface StudentQuestionHelpInput {
  readonly roomId: string;
  readonly runId: string;
  readonly message: string;
  readonly interactionCount: number;
  readonly helpLevel: number;
}

export interface StudentQuestionHelpReply { readonly hint: string; readonly helpLevel: number }

export async function requestStudentQuestionHelp(input: StudentQuestionHelpInput): Promise<StudentQuestionHelpReply> {
  const callable = httpsCallable<StudentQuestionHelpInput, StudentQuestionHelpReply>(functions, "getStudentQuestionAuthoringHelp");
  return (await callable(input)).data;
}

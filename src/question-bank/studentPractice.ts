import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/firebaseClient.ts";
import type { ExamQuestionContent } from "./types.ts";
import { parseExamQuestion } from "./validation.ts";

/** Questions per "문제 만들기" press; the server generates exactly this many. */
export const PRACTICE_BATCH_SIZE = 5;
const AVOID_LIMIT = 40;

/**
 * Asks the server for a batch of exam-style questions on a reading set. Students only name the set;
 * the server reads its text and applies the daily limit.
 */
export async function requestPracticeQuestions(setId: string, previous: readonly ExamQuestionContent[]): Promise<readonly ExamQuestionContent[]> {
  const callable = httpsCallable<unknown, unknown>(functions, "generateStudentExamPractice", { timeout: 360_000 });
  const result = await callable({
    setId,
    avoid: previous.slice(-AVOID_LIMIT).map((question) => `${question.prompt} ${question.context ?? ""}`.slice(0, 200)),
  });
  const data = result.data as { questions?: unknown } | null;
  if (!data || !Array.isArray(data.questions)) throw new Error("문제 생성 응답 형식이 올바르지 않습니다.");
  return data.questions.map(parseExamQuestion);
}

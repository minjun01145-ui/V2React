import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/firebaseClient.ts";
import type { RuntimeLearningSet } from "../learning-sets/types.ts";
import { parseAiUsage, type AiUsage } from "../shared/aiUsage.ts";
import type { ExamQuestionContent } from "./types.ts";
import { parseExamQuestion } from "./validation.ts";

export interface GeneratedExamQuestions { readonly questions: readonly ExamQuestionContent[]; readonly usage: AiUsage | null }

/** How many of the existing prompts are sent so the AI avoids repeating them. */
const AVOID_LIMIT = 40;

/** Asks AI2 for `count` exam-style questions on the set's text, avoiding already saved ones. */
export async function generateExamQuestions(set: RuntimeLearningSet, count: number, existing: readonly ExamQuestionContent[]): Promise<GeneratedExamQuestions> {
  const callable = httpsCallable<unknown, unknown>(functions, "generateExamQuestions", { timeout: 360_000 });
  const result = await callable({
    name: set.name,
    items: set.items.map(({ sourceText, meaning }) => ({ sourceText, meaning })),
    count,
    avoid: existing.slice(-AVOID_LIMIT).map((question) => `${question.prompt} ${question.context ?? ""}`.slice(0, 200)),
  });
  const data = result.data as { questions?: unknown; usage?: unknown } | null;
  if (!data || !Array.isArray(data.questions)) throw new Error("문제 생성 응답 형식이 올바르지 않습니다.");
  return { questions: data.questions.map(parseExamQuestion), usage: parseAiUsage(data.usage) };
}

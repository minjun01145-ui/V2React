import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebaseClient.ts";
import type { PracticeResponse } from "../../question-bank/grading.ts";
import type { ExamQuestionContent } from "../../question-bank/types.ts";
import { parseExamQuestion } from "../../question-bank/validation.ts";

/** A question the student got wrong, kept in their 오답노트 until they delete it. */
export interface WrongAnswer {
  readonly id: string;
  readonly setName: string;
  readonly content: ExamQuestionContent;
  readonly response: PracticeResponse;
  readonly createdAtMs: number;
}

/** Owned by the student's game-data account; only they (and admins) can read it (Firestore rules). */
const notebookRef = (accountId: string) => collection(db, "studentGameData", accountId, "examWrongAnswers");

function parseResponse(value: unknown): PracticeResponse | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (raw.format === "choice" && typeof raw.choice === "number" && Number.isInteger(raw.choice)) return { format: "choice", choice: raw.choice };
  if (raw.format === "written" && typeof raw.text === "string") return { format: "written", text: raw.text.slice(0, 600) };
  return null;
}

export async function saveWrongAnswer(accountId: string, entry: { readonly setId: string; readonly setName: string; readonly content: ExamQuestionContent; readonly response: PracticeResponse }): Promise<string> {
  const saved = await addDoc(notebookRef(accountId), {
    setId: entry.setId,
    setName: entry.setName.slice(0, 120),
    content: entry.content,
    response: entry.response.format === "written" ? { format: "written", text: entry.response.text.slice(0, 600) } : entry.response,
    createdAt: serverTimestamp(),
    createdAtMs: Date.now(),
  });
  return saved.id;
}

/** Newest first; entries that no longer parse are skipped. */
export async function listWrongAnswers(accountId: string): Promise<readonly WrongAnswer[]> {
  const snapshot = await getDocs(query(notebookRef(accountId), orderBy("createdAtMs", "desc")));
  return snapshot.docs.flatMap((item) => {
    const data = item.data();
    const response = parseResponse(data.response);
    try {
      return response && typeof data.createdAtMs === "number"
        ? [{ id: item.id, setName: typeof data.setName === "string" ? data.setName : "", content: parseExamQuestion(data.content), response, createdAtMs: data.createdAtMs }]
        : [];
    } catch {
      return [];
    }
  });
}

export async function deleteWrongAnswer(accountId: string, entryId: string): Promise<void> {
  await deleteDoc(doc(notebookRef(accountId), entryId));
}

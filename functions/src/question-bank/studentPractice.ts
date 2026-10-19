import { FieldValue } from "firebase-admin/firestore";
import { db } from "../shared/firebase.js";
import { belongsToTenant } from "../shared/tenant.js";
import { tenantLearningSetsCollection } from "../shared/tenantData.js";
import type { TenantId } from "../shared/tenant.js";
import { isRecord } from "../shared/validation.js";
import { ExamQuestionValidationError, type ExamQuestion } from "./model.js";
import { generateExamQuestionDraft } from "./service.js";

/**
 * Exam practice for students: the same AI question generator the teacher uses, but the set is read
 * on the server (students never send text to the AI) and each student has a daily batch limit.
 */
export const STUDENT_PRACTICE_BATCH_SIZE = 5;
export const STUDENT_DAILY_BATCH_LIMIT = 10;
const SET_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export interface StudentPracticeRequest {
  readonly setId: string;
  readonly avoid: readonly string[];
}

export function parseStudentPracticeRequest(value: unknown): StudentPracticeRequest {
  if (!isRecord(value) || typeof value.setId !== "string" || !SET_ID_PATTERN.test(value.setId)) throw new ExamQuestionValidationError("학습 세트를 선택해주세요.");
  const avoid = Array.isArray(value.avoid)
    ? value.avoid.filter((entry): entry is string => typeof entry === "string").slice(-40).map((entry) => entry.slice(0, 200))
    : [];
  return { setId: value.setId, avoid };
}

/** Korean calendar day, so the limit resets at midnight for the class. */
export function practiceDayKey(nowMs: number): string {
  return new Date(nowMs + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function loadReadingSet(tenantId: TenantId, setId: string): Promise<{ readonly name: string; readonly items: readonly { readonly sourceText: string; readonly meaning: string }[] }> {
  const setRef = tenantLearningSetsCollection(tenantId).doc(setId);
  const [metadataSnapshot, contentSnapshot] = await Promise.all([setRef.get(), setRef.collection("content").doc("main").get()]);
  const metadata: unknown = metadataSnapshot.exists ? metadataSnapshot.data() : null;
  const content: unknown = contentSnapshot.exists ? contentSnapshot.data() : null;
  if (!isRecord(metadata) || !belongsToTenant(metadata.tenantId, tenantId) || metadata.type !== "reading-chunks") {
    throw new ExamQuestionValidationError("본문이 있는 끊어읽기 세트를 선택해주세요.");
  }
  const items = isRecord(content) && Array.isArray(content.items)
    ? content.items.flatMap((item: unknown) => isRecord(item) && typeof item.sourceText === "string" && item.sourceText.trim()
      ? [{ sourceText: item.sourceText.replaceAll("/", " ").replace(/\s+/g, " ").trim().slice(0, 1000), meaning: typeof item.meaning === "string" ? item.meaning.replaceAll("/", " ").trim().slice(0, 1000) : "" }]
      : [])
    : [];
  if (!items.length) throw new ExamQuestionValidationError("이 세트에는 문제를 만들 본문이 없습니다.");
  return { name: typeof metadata.name === "string" && metadata.name.trim() ? metadata.name.trim().slice(0, 120) : "본문", items: items.slice(0, 100) };
}

const usageRef = (studentAccountId: string, day: string) => db.collection("examPracticeUsage").doc(`${studentAccountId}__${day}`);

/** Takes one batch from today's allowance; throws when it is used up. */
async function reserveBatch(studentAccountId: string, day: string): Promise<void> {
  await db.runTransaction(async (tx) => {
    const ref = usageRef(studentAccountId, day);
    const snapshot = await tx.get(ref);
    const used = snapshot.exists && typeof snapshot.data()?.count === "number" ? snapshot.data()!.count as number : 0;
    if (used >= STUDENT_DAILY_BATCH_LIMIT) throw new ExamQuestionValidationError(`오늘은 문제를 ${STUDENT_DAILY_BATCH_LIMIT}번까지 만들 수 있어요. 내일 다시 만들어 주세요.`);
    tx.set(ref, { studentAccountId, day, count: used + 1, updatedAt: FieldValue.serverTimestamp() });
  });
}

export async function generateStudentPracticeQuestions(
  student: { readonly tenantId: TenantId; readonly studentAccountId: string },
  value: unknown,
  nowMs = Date.now(),
): Promise<{ readonly questions: readonly ExamQuestion[] }> {
  const request = parseStudentPracticeRequest(value);
  const set = await loadReadingSet(student.tenantId, request.setId);
  const day = practiceDayKey(nowMs);
  await reserveBatch(student.studentAccountId, day);
  try {
    const result = await generateExamQuestionDraft({ name: set.name, items: set.items, count: STUDENT_PRACTICE_BATCH_SIZE, avoid: request.avoid });
    return { questions: result.questions };
  } catch (error: unknown) {
    // A failed generation does not use up the student's allowance.
    await usageRef(student.studentAccountId, day).update({ count: FieldValue.increment(-1) }).catch(() => undefined);
    throw error;
  }
}

import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { db } from "../firebase/firebaseClient.ts";
import { currentTenantConfig } from "../tenant/config.ts";
import type { BankQuestion, ExamQuestionContent } from "./types.ts";
import { parseExamQuestion } from "./validation.ts";

/** tenants/{tenantId}/questionBank/{id}: one document per saved question, tagged with its learning set. */
function bankCollection() {
  return collection(db, "tenants", currentTenantConfig().id, "questionBank");
}

/** Saved questions of a set, oldest first; a damaged document is skipped rather than hiding the rest. */
export async function listBankQuestions(setId: string): Promise<BankQuestion[]> {
  const snapshot = await getDocs(query(bankCollection(), where("setId", "==", setId)));
  return snapshot.docs.flatMap((entry) => {
    const data = entry.data();
    try {
      return [{ id: entry.id, setId, content: parseExamQuestion(data.question), createdAtMs: typeof data.createdAtMs === "number" ? data.createdAtMs : 0 }];
    } catch {
      return [];
    }
  }).sort((left, right) => left.createdAtMs - right.createdAtMs || left.id.localeCompare(right.id));
}

export async function saveBankQuestions(setId: string, contents: readonly ExamQuestionContent[]): Promise<void> {
  const batch = writeBatch(db);
  const tenantId = currentTenantConfig().id;
  const now = Date.now();
  contents.forEach((question, index) => batch.set(doc(bankCollection()), {
    tenantId, setId, question, createdAtMs: now + index, createdAt: serverTimestamp(),
  }));
  await batch.commit();
}

export async function deleteBankQuestion(questionId: string): Promise<void> {
  await deleteDoc(doc(bankCollection(), questionId));
}

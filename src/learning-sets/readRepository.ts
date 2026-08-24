import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebaseClient.ts";
import { parseLearningSet, parseLearningSetSummary } from "./codec.ts";
import type { LearningSet, LearningSetSummary } from "./types.ts";

const learningSetsRef = collection(db, "learningSets");
const metadataRef = (setId: string) => doc(db, "learningSets", setId);
const contentRef = (setId: string) => doc(db, "learningSets", setId, "content", "main");

export async function listLearningSets(): Promise<readonly LearningSetSummary[]> {
  const snapshot = await getDocs(learningSetsRef);
  return snapshot.docs
    .map((setDoc) => parseLearningSetSummary(setDoc.id, setDoc.data()))
    .filter((set): set is LearningSetSummary => set !== null)
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs || a.name.localeCompare(b.name, "ko-KR"));
}

export async function getLearningSet(setId: string): Promise<LearningSet> {
  const [metadata, content] = await Promise.all([getDoc(metadataRef(setId)), getDoc(contentRef(setId))]);
  const parsed = parseLearningSet(setId, metadata.exists() ? metadata.data() : null, content.exists() ? content.data() : null);
  if (!parsed) throw new Error("학습 세트를 찾을 수 없거나 데이터 형식이 올바르지 않습니다.");
  return parsed;
}

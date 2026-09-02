import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebaseClient.ts";
import { parseLearningSet, parseLearningSetSummary } from "./codec.ts";
import type { LearningSet, LearningSetSummary } from "./types.ts";

const learningSetsRef = collection(db, "learningSets");
const metadataRef = (setId: string) => doc(db, "learningSets", setId);
const contentRef = (setId: string) => doc(db, "learningSets", setId, "content", "main");
const setCache = new Map<string, Map<string, Promise<LearningSet>>>();
const SET_CACHE_TTL_MS = 15 * 60_000;

export async function listLearningSets(): Promise<readonly LearningSetSummary[]> {
  const snapshot = await getDocs(learningSetsRef);
  return snapshot.docs
    .map((setDoc) => parseLearningSetSummary(setDoc.id, setDoc.data()))
    .filter((set): set is LearningSetSummary => set !== null)
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs || a.name.localeCompare(b.name, "ko-KR"));
}

export function getLearningSet(setId: string, scope = "default"): Promise<LearningSet> {
  const scopedCache = setCache.get(setId) ?? new Map<string, Promise<LearningSet>>();
  setCache.set(setId, scopedCache);
  const cached = scopedCache.get(scope);
  if (cached) return cached;
  const request = Promise.all([getDoc(metadataRef(setId)), getDoc(contentRef(setId))])
    .then(([metadata, content]) => {
      const parsed = parseLearningSet(setId, metadata.exists() ? metadata.data() : null, content.exists() ? content.data() : null);
      if (!parsed) throw new Error("학습 세트를 찾을 수 없거나 데이터 형식이 올바르지 않습니다.");
      return parsed;
    })
    .catch((error: unknown) => {
      scopedCache.delete(scope);
      if (scopedCache.size === 0) setCache.delete(setId);
      throw error;
    });
  scopedCache.set(scope, request);
  globalThis.setTimeout(() => {
    if (scopedCache.get(scope) !== request) return;
    scopedCache.delete(scope);
    if (scopedCache.size === 0) setCache.delete(setId);
  }, SET_CACHE_TTL_MS);
  return request;
}

export function invalidateLearningSetCache(setId: string): void {
  setCache.delete(setId);
}

import { doc, getDoc, getDocs } from "firebase/firestore";
import { currentTenantConfig } from "../tenant/config.ts";
import { tenantLearningSetRef, tenantLearningSetsCollection } from "../tenant/firestoreData.ts";
import { parseLearningSet, parseLearningSetSummary } from "./codec.ts";
import type { LearningSet, LearningSetSummary } from "./types.ts";

const setCache = new Map<string, Map<string, Promise<LearningSet>>>();
const SET_CACHE_TTL_MS = 15 * 60_000;

export async function listLearningSets(): Promise<readonly LearningSetSummary[]> {
  const tenantId = currentTenantConfig().id;
  const snapshot = await getDocs(tenantLearningSetsCollection(tenantId));
  return snapshot.docs
    .map((setDoc) => parseLearningSetSummary(setDoc.id, setDoc.data()))
    .filter((set): set is LearningSetSummary => set !== null)
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs || a.name.localeCompare(b.name, "ko-KR"));
}

export function getLearningSet(setId: string, scope = "default"): Promise<LearningSet> {
  const tenantId = currentTenantConfig().id;
  const cacheKey = `${tenantId}:${setId}`;
  const scopedCache = setCache.get(cacheKey) ?? new Map<string, Promise<LearningSet>>();
  setCache.set(cacheKey, scopedCache);
  const cached = scopedCache.get(scope);
  if (cached) return cached;
  const setRef = tenantLearningSetRef(tenantId, setId);
  const request = Promise.all([getDoc(setRef), getDoc(doc(setRef, "content", "main"))])
    .then(([metadata, content]) => {
      if (!metadata.exists()) throw new Error("학습 세트를 찾을 수 없습니다.");
      const parsed = parseLearningSet(setId, metadata.exists() ? metadata.data() : null, content.exists() ? content.data() : null);
      if (!parsed) throw new Error("학습 세트를 찾을 수 없거나 데이터 형식이 올바르지 않습니다.");
      return parsed;
    })
    .catch((error: unknown) => {
      scopedCache.delete(scope);
      if (scopedCache.size === 0) setCache.delete(cacheKey);
      throw error;
    });
  scopedCache.set(scope, request);
  globalThis.setTimeout(() => {
    if (scopedCache.get(scope) !== request) return;
    scopedCache.delete(scope);
    if (scopedCache.size === 0) setCache.delete(cacheKey);
  }, SET_CACHE_TTL_MS);
  return request;
}

export function invalidateLearningSetCache(setId: string): void {
  for (const key of setCache.keys()) {
    if (key.endsWith(`:${setId}`)) setCache.delete(key);
  }
}

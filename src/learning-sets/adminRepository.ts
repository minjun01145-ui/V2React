import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase/firebaseClient.ts";
import { currentTenantConfig } from "../tenant/config.ts";
import { tenantLearningSetRef } from "../tenant/firestoreData.ts";
import type { LearningSet, SaveLearningSetInput } from "./types.ts";
import { validateLearningSetName } from "./validation.ts";
import { invalidateLearningSetCache } from "./readRepository.ts";

const SET_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function validSetId(value: string): string {
  if (!SET_ID_PATTERN.test(value)) throw new Error("학습 세트 ID가 올바르지 않습니다.");
  return value;
}

export async function saveLearningSet(input: SaveLearningSetInput): Promise<LearningSet> {
  const tenantId = currentTenantConfig().id;
  const id = validSetId(input.id ?? crypto.randomUUID());
  const name = validateLearningSetName(input.name);
  const now = Date.now();
  const createdAtMs = input.createdAtMs && input.createdAtMs > 0 ? input.createdAtMs : now;
  const items = input.items.map((item) => ({ id: item.id, sourceText: item.sourceText, meaning: item.meaning, ...(item.author ? { author: item.author } : {}) }));
  const batch = writeBatch(db);
  const setRef = tenantLearningSetRef(tenantId, id);
  batch.set(setRef, {
    name,
    tenantId,
    type: input.type,
    itemCount: items.length,
    schemaVersion: 1,
    ...(input.id ? {} : { createdAt: serverTimestamp() }),
    createdAtMs,
    updatedAt: serverTimestamp(),
    updatedAtMs: now,
  }, { merge: true });
  batch.set(doc(setRef, "content", "main"), {
    items,
    schemaVersion: 1,
    updatedAt: serverTimestamp(),
    updatedAtMs: now,
  });
  await batch.commit();
  invalidateLearningSetCache(id);
  return { id, name, type: input.type, itemCount: items.length, createdAtMs, updatedAtMs: now, items };
}

export async function deleteLearningSet(setId: string): Promise<void> {
  const id = validSetId(setId);
  const tenantId = currentTenantConfig().id;
  const setRef = tenantLearningSetRef(tenantId, id);
  const metadata = await getDoc(setRef);
  if (!metadata.exists()) throw new Error("학습 세트를 찾을 수 없습니다.");
  const batch = writeBatch(db);
  batch.delete(doc(setRef, "content", "main"));
  batch.delete(setRef);
  await batch.commit();
  invalidateLearningSetCache(id);
}

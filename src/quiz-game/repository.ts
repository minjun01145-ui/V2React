import { deleteDoc, getDoc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { currentTenantConfig } from "../tenant/config.ts";
import { tenantQuizPlanRef, tenantQuizPlansCollection } from "../tenant/firestoreData.ts";
import { QUIZ_GAME_SCHEMA_VERSION, type QuizGamePlan, type QuizGamePlanSummary, type SaveQuizGamePlanInput } from "./types.ts";
import { parseQuizGamePlan, parseQuizGamePlanSummary, validateQuizGameName, validateQuizGameRounds } from "./validation.ts";

export async function listQuizGamePlans(): Promise<readonly QuizGamePlanSummary[]> {
  const tenantId = currentTenantConfig().id;
  const snapshot = await getDocs(tenantQuizPlansCollection(tenantId));
  return snapshot.docs
    .map((item) => parseQuizGamePlanSummary(item.id, item.data()))
    .filter((item): item is QuizGamePlanSummary => item !== null)
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs || a.name.localeCompare(b.name, "ko-KR"));
}

export async function getQuizGamePlan(id: string): Promise<QuizGamePlan> {
  const snapshot = await getDoc(tenantQuizPlanRef(currentTenantConfig().id, id));
  if (!snapshot.exists()) throw new Error("퀴즈 계획을 찾을 수 없습니다.");
  const plan = parseQuizGamePlan(snapshot.id, snapshot.exists() ? snapshot.data() : null);
  if (!plan) throw new Error("퀴즈 계획을 찾을 수 없거나 형식이 올바르지 않습니다.");
  return plan;
}

export async function saveQuizGamePlan(input: SaveQuizGamePlanInput): Promise<QuizGamePlan> {
  const id = input.id ?? crypto.randomUUID();
  const name = validateQuizGameName(input.name);
  const rounds = validateQuizGameRounds(input.rounds);
  const now = Date.now();
  const plan: QuizGamePlan = {
    id,
    name,
    schemaVersion: QUIZ_GAME_SCHEMA_VERSION,
    rounds,
    createdAtMs: input.createdAtMs && input.createdAtMs > 0 ? input.createdAtMs : now,
    updatedAtMs: now,
  };
  await setDoc(tenantQuizPlanRef(currentTenantConfig().id, id), { ...plan, tenantId: currentTenantConfig().id, updatedAt: serverTimestamp() });
  return plan;
}

export async function deleteQuizGamePlan(id: string): Promise<void> {
  const ref = tenantQuizPlanRef(currentTenantConfig().id, id);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error("퀴즈 계획을 찾을 수 없습니다.");
  await deleteDoc(ref);
}

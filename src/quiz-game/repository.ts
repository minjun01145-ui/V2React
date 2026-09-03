import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseClient.ts";
import { QUIZ_GAME_SCHEMA_VERSION, type QuizGamePlan, type QuizGamePlanSummary, type SaveQuizGamePlanInput } from "./types.ts";
import { parseQuizGamePlan, parseQuizGamePlanSummary, validateQuizGameName, validateQuizGameRounds } from "./validation.ts";

const plansRef = collection(db, "quizGamePlans");
const planRef = (id: string) => doc(db, "quizGamePlans", id);

export async function listQuizGamePlans(): Promise<readonly QuizGamePlanSummary[]> {
  const snapshot = await getDocs(plansRef);
  return snapshot.docs
    .map((item) => parseQuizGamePlanSummary(item.id, item.data()))
    .filter((item): item is QuizGamePlanSummary => item !== null)
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs || a.name.localeCompare(b.name, "ko-KR"));
}

export async function getQuizGamePlan(id: string): Promise<QuizGamePlan> {
  const snapshot = await getDoc(planRef(id));
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
  await setDoc(planRef(id), { ...plan, updatedAt: serverTimestamp() });
  return plan;
}

export async function deleteQuizGamePlan(id: string): Promise<void> {
  await deleteDoc(planRef(id));
}

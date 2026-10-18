import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/firebaseClient.ts";
import type { RuntimeLearningSet } from "../learning-sets/types.ts";
import { parseMeaningsResult, parsePracticeResult } from "./model.ts";

export async function generatePracticeWorksheet(set: RuntimeLearningSet) {
  const callable = httpsCallable<unknown, unknown>(functions, "generateWorksheet", { timeout: 360_000 });
  const result = await callable({ mode: "practice", name: set.name, items: set.items.map(({ id, sourceText, meaning }) => ({ id, sourceText, meaning })) });
  return parsePracticeResult(result.data);
}

export async function completeWorksheetMeanings(set: RuntimeLearningSet) {
  const callable = httpsCallable<unknown, unknown>(functions, "generateWorksheet", { timeout: 360_000 });
  const result = await callable({ mode: "meanings", name: set.name, items: set.items.map(({ id, sourceText, meaning }) => ({ id, sourceText, meaning })) });
  return parseMeaningsResult(result.data, set.items.filter(item => !item.meaning.trim()).map(item => item.id));
}

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase/firebaseClient.ts";
import type { RuntimeLearningSet } from "../learning-sets/types.ts";
import { parseAiUsage, type AiUsage } from "../shared/aiUsage.ts";
import { currentTenantConfig } from "../tenant/config.ts";
import type { WorksheetDocument } from "../worksheet/types.ts";
import { parseWorksheetDocument } from "../worksheet/validation.ts";
import { parseMeaningsResult, parsePracticeResult, type WorksheetKind } from "./model.ts";

const generateCallable = () => httpsCallable<unknown, unknown>(functions, "generateWorksheet", { timeout: 360_000 });
const payload = (set: RuntimeLearningSet) => set.items.map(({ id, sourceText, meaning }) => ({ id, sourceText, meaning }));

export async function generatePracticeWorksheet(set: RuntimeLearningSet) {
  return parsePracticeResult((await generateCallable()({ mode: "practice", name: set.name, items: payload(set) })).data);
}

export async function completeWorksheetMeanings(set: RuntimeLearningSet) {
  const missing = set.items.filter((item) => !item.meaning.trim()).map((item) => item.id);
  if (!missing.length) return { meanings: [], usage: null };
  return parseMeaningsResult((await generateCallable()({ mode: "meanings", name: set.name, items: payload(set) })).data, missing);
}

export interface SavedWorksheet {
  readonly document: WorksheetDocument;
  readonly usage: AiUsage | null;
}

/** One saved worksheet per set and kind; saving again replaces it. */
function worksheetRef(setId: string, kind: WorksheetKind) {
  return doc(db, "tenants", currentTenantConfig().id, "worksheets", `${setId}__${kind}`);
}

export async function loadSavedWorksheet(setId: string, kind: WorksheetKind): Promise<SavedWorksheet | null> {
  const snapshot = await getDoc(worksheetRef(setId, kind));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return { document: parseWorksheetDocument(data.document), usage: parseAiUsage(data.usage) };
}

export async function saveWorksheet(setId: string, kind: WorksheetKind, saved: SavedWorksheet): Promise<void> {
  await setDoc(worksheetRef(setId, kind), {
    tenantId: currentTenantConfig().id, setId, kind, document: saved.document, usage: saved.usage, updatedAt: serverTimestamp(),
  });
}

import { doc, getDoc } from "firebase/firestore";
import { currentTenantConfig } from "../tenant/config.ts";
import { tenantLearningSetRef } from "../tenant/firestoreData.ts";
import { parseFillBlankBank, type FillBlankBank } from "./fillBlankBank.ts";

/** Never blocks a game: a missing or unreadable bank means rule-made blanks. */
export async function loadFillBlankBank(setId: string): Promise<FillBlankBank> {
  try {
    const snapshot = await getDoc(doc(tenantLearningSetRef(currentTenantConfig().id, setId), "content", "fillBlanks"));
    return parseFillBlankBank(snapshot.data());
  } catch {
    return new Map();
  }
}

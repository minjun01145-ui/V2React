import { logger } from "firebase-functions";
import { onDocumentWritten, type FirestoreEvent, type Change, type DocumentSnapshot } from "firebase-functions/v2/firestore";
import { isRecord } from "../shared/validation.js";
import { FILL_BLANK_BANK_DOC, parseStoredBank, type BankSentenceInput } from "./model.js";
import { prepareFillBlanks } from "./service.js";

const READING_CHUNKS = "reading-chunks";
const options = { region: "asia-northeast3", timeoutSeconds: 540, memory: "256MiB", maxInstances: 3, retry: false } as const;

/** Rebuilds a reading set's prepared blanks whenever its text is saved; deletes them with the set. */
async function refreshFillBlankBank(event: FirestoreEvent<Change<DocumentSnapshot> | undefined>): Promise<void> {
  const change = event.data;
  if (!change) return;
  const bankRef = change.after.ref.parent.doc(FILL_BLANK_BANK_DOC);
  const after: unknown = change.after.data();
  if (!change.after.exists || !isRecord(after) || !Array.isArray(after.items)) {
    await bankRef.delete();
    return;
  }
  const setDoc = await change.after.ref.parent.parent!.get();
  if (setDoc.get("type") !== READING_CHUNKS) return;

  const inputs: BankSentenceInput[] = after.items.flatMap((item: unknown) => isRecord(item) && typeof item.id === "string" && typeof item.sourceText === "string" && item.sourceText.trim()
    ? [{ id: item.id, sourceText: item.sourceText, meaning: typeof item.meaning === "string" ? item.meaning : "" }]
    : []).slice(0, 100);
  const previous = parseStoredBank((await bankRef.get()).data());
  if (inputs.every((input) => previous.get(input.id)?.sourceText === input.sourceText) && previous.size === inputs.length) return;

  const sentences = await prepareFillBlanks(inputs, previous);
  await bankRef.set({ schemaVersion: 1, sentences, updatedAtMs: Date.now() });
  logger.info("Fill-blank bank prepared", { set: setDoc.ref.path, sentences: Object.keys(sentences).length, of: inputs.length });
}

export const prepareFillBlanksPrimary = onDocumentWritten({ ...options, document: "learningSets/{setId}/content/main" }, refreshFillBlankBank);
export const prepareFillBlanksTenant = onDocumentWritten({ ...options, document: "tenants/{tenantId}/learningSets/{setId}/content/main" }, refreshFillBlankBank);

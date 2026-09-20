import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/firebaseClient.ts";
import { LEARNING_SET_TYPE, type LearningSetItem, type LearningSetType } from "./types.ts";

export type AiGeneratableLearningSetType =
  | typeof LEARNING_SET_TYPE.VOCABULARY
  | typeof LEARNING_SET_TYPE.READING_CHUNKS
  | typeof LEARNING_SET_TYPE.FORM_CHANGES;

export interface LearningSetGenerationFile {
  readonly name: string;
  readonly mimeType: string;
  readonly base64: string;
}

export interface LearningSetGenerationInput {
  readonly type: AiGeneratableLearningSetType;
  readonly sourceText: string;
  readonly file: LearningSetGenerationFile | null;
}

export interface LearningSetGenerationResult {
  readonly suggestedName: string;
  readonly items: readonly LearningSetItem[];
}

export const MAX_AI_SOURCE_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_AI_SOURCE_TEXT_CHARACTERS = 4_000;
export const AI_SOURCE_FILE_ACCEPT = ".pdf,.txt,.csv,.tsv,.md,application/pdf,text/plain,text/csv,text/tab-separated-values";

export function isAiGeneratableLearningSetType(type: LearningSetType): type is AiGeneratableLearningSetType {
  return type === LEARNING_SET_TYPE.VOCABULARY
    || type === LEARNING_SET_TYPE.READING_CHUNKS
    || type === LEARNING_SET_TYPE.FORM_CHANGES;
}

export async function browserFileForLearningSetGeneration(file: File): Promise<LearningSetGenerationFile> {
  if (file.size < 1 || file.size > MAX_AI_SOURCE_FILE_BYTES) throw new Error("파일은 4MB 이하만 사용할 수 있습니다.");
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(",");
      if (comma < 0) reject(new Error("파일을 읽지 못했습니다."));
      else resolve(result.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
  return { name: file.name, mimeType: file.type, base64 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseResult(value: unknown, type: AiGeneratableLearningSetType): LearningSetGenerationResult {
  if (!isRecord(value) || !Array.isArray(value.items) || value.items.length < 1) throw new Error("AI 생성 결과 형식이 올바르지 않습니다.");
  const items = value.items.map((raw, index): LearningSetItem => {
    if (!isRecord(raw)) throw new Error("AI 생성 결과 항목 형식이 올바르지 않습니다.");
    const sourceText = typeof raw.sourceText === "string" ? raw.sourceText.trim() : "";
    const meaning = typeof raw.meaning === "string" ? raw.meaning.trim() : "";
    if (!sourceText || !meaning) throw new Error("AI 생성 결과에 빈 영어 또는 뜻이 있습니다.");
    if (type === LEARNING_SET_TYPE.FORM_CHANGES) {
      const form2 = typeof raw.form2 === "string" ? raw.form2.trim() : "";
      const form3 = typeof raw.form3 === "string" ? raw.form3.trim() : "";
      if (!form2 || !form3) throw new Error("AI 생성 결과에 빠진 변화 형태가 있습니다.");
      return { id: `item-${String(index + 1).padStart(3, "0")}`, sourceText, meaning, form2, form3 };
    }
    return { id: `item-${String(index + 1).padStart(3, "0")}`, sourceText, meaning };
  });
  const suggestedName = typeof value.suggestedName === "string" ? value.suggestedName.trim().slice(0, 80) : "";
  return { suggestedName, items };
}

export async function generateLearningSetDraft(input: LearningSetGenerationInput): Promise<LearningSetGenerationResult> {
  const callable = httpsCallable<LearningSetGenerationInput, unknown>(functions, "generateLearningSet");
  const response = await callable(input);
  return parseResult(response.data, input.type);
}

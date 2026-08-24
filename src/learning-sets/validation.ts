import { LEARNING_SET_TYPE, type LearningSetItem, type LearningSetType } from "./types.ts";

export const MAX_LEARNING_SET_ITEMS = 500;
export const MAX_LEARNING_SET_CHARACTERS = 200_000;

const SOURCE_HEADERS = new Set(["단어", "문장", "표현", "영어", "word", "sentence", "text"]);
const MEANING_HEADERS = new Set(["뜻", "의미", "해석", "번역", "meaning", "translation"]);

function splitRow(line: string): readonly [string, string] {
  const tabIndex = line.indexOf("\t");
  const separatorIndex = tabIndex >= 0 ? tabIndex : line.indexOf(",");
  if (separatorIndex < 0) return [line.trim(), ""];
  return [line.slice(0, separatorIndex).trim(), line.slice(separatorIndex + 1).trim()];
}

function isHeader(sourceText: string, meaning: string): boolean {
  return SOURCE_HEADERS.has(sourceText.toLowerCase()) && MEANING_HEADERS.has(meaning.toLowerCase());
}

function validateItem(sourceText: string, meaning: string, type: LearningSetType, lineNumber: number): void {
  if (!sourceText || !meaning) throw new Error(`${lineNumber}번째 줄: 단어(문장)와 뜻 두 칸을 모두 입력해 주세요.`);
  if (sourceText.length > 500) throw new Error(`${lineNumber}번째 줄: 단어 또는 문장은 500자 이하로 입력해 주세요.`);
  if (meaning.length > 1000) throw new Error(`${lineNumber}번째 줄: 뜻은 1000자 이하로 입력해 주세요.`);
  if (type === LEARNING_SET_TYPE.READING_CHUNKS) {
    const chunks = sourceText.split("/").map((chunk) => chunk.trim()).filter(Boolean);
    if (chunks.length < 2) throw new Error(`${lineNumber}번째 줄: 끊어읽기 문장은 두 조각 이상이 되도록 / 기호로 나눠 주세요.`);
    if (meaning.includes("/")) {
      const meaningChunks = meaning.split("/").map((chunk) => chunk.trim()).filter(Boolean);
      if (meaningChunks.length !== chunks.length) throw new Error(`${lineNumber}번째 줄: 영어와 뜻의 덩어리 수를 같게 맞춰 주세요.`);
    }
  }
}

export function validateLearningSetName(value: unknown): string {
  const name = String(value ?? "").trim();
  if (name.length < 1 || name.length > 80) throw new Error("세트 이름은 1자부터 80자까지 입력해 주세요.");
  return name;
}

export function parseLearningSetPaste(value: string, type: LearningSetType): readonly LearningSetItem[] {
  const rows = value.split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
    .filter(({ line }) => Boolean(line));
  if (rows.length < 1) throw new Error("붙여넣을 세트 내용을 입력해 주세요.");

  const first = splitRow(rows[0]?.line ?? "");
  const contentRows = isHeader(first[0], first[1]) ? rows.slice(1) : rows;
  if (contentRows.length < 1) throw new Error("머리글 아래에 학습 항목을 한 줄 이상 입력해 주세요.");
  if (contentRows.length > MAX_LEARNING_SET_ITEMS) throw new Error(`한 세트에는 최대 ${MAX_LEARNING_SET_ITEMS}개까지 저장할 수 있습니다.`);

  let totalCharacters = 0;
  return contentRows.map(({ line, lineNumber }, index) => {
    const [sourceText, meaning] = splitRow(line);
    validateItem(sourceText, meaning, type, lineNumber);
    totalCharacters += sourceText.length + meaning.length;
    if (totalCharacters > MAX_LEARNING_SET_CHARACTERS) throw new Error("세트 전체 내용이 너무 큽니다. 여러 세트로 나누어 주세요.");
    return { id: `item-${String(index + 1).padStart(3, "0")}`, sourceText, meaning };
  });
}

export function serializeLearningSetItems(items: readonly LearningSetItem[]): string {
  return items.map((item) => `${item.sourceText}\t${item.meaning}`).join("\n");
}

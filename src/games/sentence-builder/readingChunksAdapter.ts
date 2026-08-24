import { validateCanonicalQuestionSet } from "../../game-engine/question-engine/canonicalQuestionSet.ts";
import type { SentenceQuestion, SentenceQuestionSet } from "./types.ts";

const READING_CHUNK_TYPES = new Set(["reading-chunks", "chunked-reading", "slash-reading", "끊어읽기", "끊어읽기 세트"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstText(...values: readonly unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function extractChunks(item: Record<string, unknown>): string[] {
  const arrayCandidate = item.chunks ?? item.parts ?? item.segments ?? item.englishParts;
  if (Array.isArray(arrayCandidate)) {
    return arrayCandidate
      .map((chunk) => isRecord(chunk) ? firstText(chunk.text, chunk.value, chunk.label) : String(chunk ?? "").trim())
      .filter((chunk) => Boolean(chunk));
  }

  const slashSentence = firstText(item.sourceText, item.chunkedEnglish, item.english, item.en, item.sentence);
  return slashSentence.includes("/")
    ? slashSentence.split("/").map((chunk) => chunk.trim()).filter(Boolean)
    : [];
}

export function isReadingChunksSet(set: unknown): boolean {
  if (!isRecord(set)) return false;
  const type = firstText(set.type, set.setType, set.category).toLowerCase();
  return READING_CHUNK_TYPES.has(type);
}

export function adaptReadingChunksSet(set: unknown): SentenceQuestionSet {
  if (!isRecord(set)) throw new Error("끊어읽기 세트 데이터가 올바른 객체가 아닙니다.");
  const items = set.items ?? set.questions ?? set.entries;
  if (!Array.isArray(items)) throw new Error("끊어읽기 세트에는 items(또는 questions) 배열이 필요합니다.");

  const setId = firstText(set.id) || "reading-chunks-set";
  const questions: SentenceQuestion[] = items.map((rawItem, index) => {
    if (!isRecord(rawItem)) throw new Error(`${index + 1}번 문항 데이터가 올바르지 않습니다.`);
    const questionId = firstText(rawItem.id) || `sentence-${index + 1}`;
    const prompt = firstText(rawItem.promptKo, rawItem.korean, rawItem.ko, rawItem.translation, rawItem.meaning);
    const chunks = extractChunks(rawItem);
    if (!prompt) throw new Error(`${index + 1}번 문항의 한글 뜻이 없습니다.`);
    if (chunks.length < 2) throw new Error(`${index + 1}번 문항은 끊어읽기 조각이 2개 이상 필요합니다.`);

    const tokens = chunks.map((chunkText, tokenIndex) => ({
      id: `${questionId}:chunk:${tokenIndex}`,
      text: chunkText,
      order: tokenIndex,
    }));

    return {
      id: questionId,
      kind: "sequence",
      prompt,
      tokens,
      expectedTokenIds: tokens.map((token) => token.id),
      source: { setId, itemIndex: index },
    };
  });

  return validateCanonicalQuestionSet({
    id: setId,
    title: firstText(set.title, set.name) || "끊어읽기 문장 만들기",
    type: "reading-chunks",
    questions,
  });
}

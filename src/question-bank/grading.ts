import type { ExamQuestionContent } from "./types.ts";

/** A student's answer: the chosen number (1–5) for a choice question, the typed text for a written one. */
export type PracticeResponse =
  | { readonly format: "choice"; readonly choice: number }
  | { readonly format: "written"; readonly text: string };

/** Ignores case, spacing and end punctuation, which a written exam answer would not be marked down for. */
export function normalizeWrittenAnswer(value: string): string {
  return value.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "").trim();
}

export function isCorrectResponse(content: ExamQuestionContent, response: PracticeResponse): boolean {
  if (content.format === "choice") return response.format === "choice" && response.choice === content.correctChoice;
  return response.format === "written" && normalizeWrittenAnswer(response.text) === normalizeWrittenAnswer(content.answer);
}

export function isAnswered(response: PracticeResponse | undefined): boolean {
  return response?.format === "choice" ? response.choice >= 1 : Boolean(response?.text.trim());
}

import type { BaseQuestion, CanonicalQuestionSet } from "../types.ts";

function requireText(value: unknown, label: string): string {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

export function validateCanonicalQuestionSet<TQuestion extends BaseQuestion>(
  set: CanonicalQuestionSet<TQuestion>,
): CanonicalQuestionSet<TQuestion> {
  requireText(set.id, "set.id");
  requireText(set.type, "set.type");
  requireText(set.title, "set.title");

  if (!Array.isArray(set.questions) || set.questions.length === 0) {
    throw new Error("Canonical set must contain at least one question.");
  }

  const questionIds = new Set<string>();
  for (const [index, question] of set.questions.entries()) {
    const id = requireText(question.id, `questions[${index}].id`);
    if (questionIds.has(id)) throw new Error(`Duplicate question id: ${id}`);
    questionIds.add(id);
  }

  return set;
}

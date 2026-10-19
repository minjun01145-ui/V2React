/** Comparison key for answers: width, spacing and case never make two answers different. */
export function answerKey(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

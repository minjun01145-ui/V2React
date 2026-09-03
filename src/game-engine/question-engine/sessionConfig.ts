export function usesFiniteQuestionSequence(gameConfig: Readonly<Record<string, unknown>> | null): boolean {
  return gameConfig?.quizQuestionSequence === "finite";
}

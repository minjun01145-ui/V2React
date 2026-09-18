
export type BattleQuestionDirection = "free" | "translation-only" | "composition-only";

export interface BattleGameConfig {
  readonly direction: BattleQuestionDirection;
  readonly answerDurationMs: 10_000 | 20_000 | 30_000 | 40_000;
}

function record(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseBattleGameConfig(value: unknown): BattleGameConfig {
  const config = record(value) ? value : {};
  const direction: BattleQuestionDirection =
    config["battle-direction"] === "translation-only"
    || config["battle-direction"] === "composition-only"
      ? config["battle-direction"]
      : "free";

  const seconds = typeof config["battle-answer-seconds"] === "string"
    ? Number(config["battle-answer-seconds"])
    : config["battle-answer-seconds"];
  const answerDurationMs: BattleGameConfig["answerDurationMs"] =
    seconds === 10 ? 10_000
      : seconds === 30 ? 30_000
        : seconds === 40 ? 40_000
          : 20_000;

  return { direction, answerDurationMs };
}

export function resolveBattleQuestionSide(
  direction: BattleQuestionDirection,
  requestedSide: "source" | "meaning",
): "source" | "meaning" {
  if (direction === "translation-only") return "meaning";
  if (direction === "composition-only") return "source";
  return requestedSide;
}

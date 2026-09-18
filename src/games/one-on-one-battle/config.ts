
export type BattleQuestionDirection = "free" | "translation-only" | "composition-only";

export interface BattleGameConfig {
  readonly direction: BattleQuestionDirection;
  readonly answerSeconds: 10 | 20 | 30 | 40;
  readonly answerDurationMs: number;
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

  const rawSeconds = typeof config["battle-answer-seconds"] === "string"
    ? Number(config["battle-answer-seconds"])
    : config["battle-answer-seconds"];
  const answerSeconds: BattleGameConfig["answerSeconds"] =
    rawSeconds === 10 || rawSeconds === 30 || rawSeconds === 40 ? rawSeconds : 20;

  return {
    direction,
    answerSeconds,
    answerDurationMs: answerSeconds * 1_000,
  };
}

export function resolveBattleQuestionSide(
  direction: BattleQuestionDirection,
  requestedSide: "source" | "meaning",
): "source" | "meaning" {
  if (direction === "translation-only") return "meaning";
  if (direction === "composition-only") return "source";
  return requestedSide;
}

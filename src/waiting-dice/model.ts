import { isDiceCount, isDiceResult, type DiceCount } from "../dice/model.ts";

export type WaitingDicePhase = "requested" | "rolling" | "result";

export interface WaitingDiceState {
  readonly requestId: string;
  readonly phase: WaitingDicePhase;
  readonly diceCount: DiceCount;
  readonly rollerId: string;
  readonly rollerLabel: string;
  readonly results: readonly number[];
  readonly requestedAtMs: number;
  readonly updatedAtMs: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseWaitingDiceState(value: unknown): WaitingDiceState | null {
  if (!isRecord(value)
    || typeof value.requestId !== "string"
    || !value.requestId
    || (value.phase !== "requested" && value.phase !== "rolling" && value.phase !== "result")
    || !isDiceCount(value.diceCount)
    || typeof value.rollerId !== "string"
    || !value.rollerId
    || typeof value.rollerLabel !== "string"
    || !value.rollerLabel.trim()
    || !Array.isArray(value.results)
    || typeof value.requestedAtMs !== "number"
    || !Number.isFinite(value.requestedAtMs)
    || typeof value.updatedAtMs !== "number"
    || !Number.isFinite(value.updatedAtMs)) return null;

  const results = value.results.filter(isDiceResult);
  const expectedResultCount = value.phase === "result" ? value.diceCount : 0;
  if (results.length !== value.results.length || results.length !== expectedResultCount) return null;
  return {
    requestId: value.requestId,
    phase: value.phase,
    diceCount: value.diceCount,
    rollerId: value.rollerId,
    rollerLabel: value.rollerLabel.trim(),
    results,
    requestedAtMs: value.requestedAtMs,
    updatedAtMs: value.updatedAtMs,
  };
}

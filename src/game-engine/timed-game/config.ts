export const TIMED_GAME_MODE = Object.freeze({
  UNLIMITED: "unlimited",
  THREE_MINUTES: "3-minutes",
  FIVE_MINUTES: "5-minutes",
} as const);

export type TimedGameMode = typeof TIMED_GAME_MODE[keyof typeof TIMED_GAME_MODE];

export interface TimedGameModeOption {
  readonly mode: TimedGameMode;
  readonly label: string;
  readonly durationMs: number | null;
}

export const TIMED_GAME_MODE_OPTIONS: readonly TimedGameModeOption[] = Object.freeze([
  { mode: TIMED_GAME_MODE.UNLIMITED, label: "무제한 (교사가 종료)", durationMs: null },
  { mode: TIMED_GAME_MODE.THREE_MINUTES, label: "3분", durationMs: 3 * 60 * 1_000 },
  { mode: TIMED_GAME_MODE.FIVE_MINUTES, label: "5분", durationMs: 5 * 60 * 1_000 },
]);

export const DEFAULT_TIMED_GAME_MODE: TimedGameMode = TIMED_GAME_MODE.THREE_MINUTES;

export interface TimedGameConfig {
  readonly mode: TimedGameMode;
  readonly durationMs: number | null;
}

export function isTimedGameMode(value: unknown): value is TimedGameMode {
  return TIMED_GAME_MODE_OPTIONS.some((option) => option.mode === value);
}

export function timedGameConfig(mode: TimedGameMode): TimedGameConfig {
  const option = TIMED_GAME_MODE_OPTIONS.find((candidate) => candidate.mode === mode)
    ?? TIMED_GAME_MODE_OPTIONS.find((candidate) => candidate.mode === DEFAULT_TIMED_GAME_MODE);
  if (!option) throw new Error("기본 시간 모드를 찾을 수 없습니다.");
  return { mode: option.mode, durationMs: option.durationMs };
}

export function readTimedGameConfig(gameConfig: Readonly<Record<string, unknown>> | null): TimedGameConfig {
  const quizDuration = gameConfig?.quizRoundDurationMs;
  if (typeof quizDuration === "number" && Number.isInteger(quizDuration) && quizDuration >= 10_000 && quizDuration <= 600_000) {
    return { mode: TIMED_GAME_MODE.UNLIMITED, durationMs: quizDuration };
  }
  const mode = gameConfig?.timedGameMode;
  return timedGameConfig(isTimedGameMode(mode) ? mode : DEFAULT_TIMED_GAME_MODE);
}

export function withTimedGameConfig(
  config: Readonly<Record<string, unknown>>,
  mode: TimedGameMode,
): Readonly<Record<string, unknown>> {
  return { ...config, timedGameMode: mode };
}

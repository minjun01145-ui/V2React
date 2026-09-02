import { TYPING_TARGET } from "./types.ts";

export interface WaitingTypingConfig {
  readonly setId: string;
  readonly target: typeof TYPING_TARGET.SOURCE;
  readonly ignoreCase: boolean;
  readonly ignorePunctuation: boolean;
}

export const DEFAULT_WAITING_TYPING_OPTIONS = Object.freeze({
  target: TYPING_TARGET.SOURCE,
  ignoreCase: true,
  ignorePunctuation: true,
} as const);

export function createWaitingTypingConfig(setId: string): WaitingTypingConfig {
  return { setId, ...DEFAULT_WAITING_TYPING_OPTIONS };
}

export function serializeWaitingTypingConfig(config: WaitingTypingConfig): Readonly<Record<string, unknown>> {
  return {
    setId: config.setId,
    target: config.target,
    ignoreCase: config.ignoreCase,
    ignorePunctuation: config.ignorePunctuation,
  };
}

export function parseWaitingTypingConfig(value: unknown): WaitingTypingConfig | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const config = value as Readonly<Record<string, unknown>>;
  if (typeof config.setId !== "string" || !config.setId.trim()) return null;
  return {
    setId: config.setId.trim(),
    target: TYPING_TARGET.SOURCE,
    ignoreCase: config.ignoreCase !== false,
    ignorePunctuation: config.ignorePunctuation !== false,
  };
}
